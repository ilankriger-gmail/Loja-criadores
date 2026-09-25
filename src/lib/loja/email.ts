import 'server-only';
import {
  claimAccessEmail, markAccessEmail, orderById, paidOrdersOfBuyer, productFull, productsByIds, releaseAccessEmail, siteUrl,
  storeById, storesByIds,
} from './db';
import { decrypt } from './crypto';
import { accessEmail, recoveryEmail, type Email } from './email-templates';
import { accessState } from './rules';

// E-mails da Loja pelo Resend (https://resend.com/docs/api-reference/emails/send-email).
// Sem RESEND_API_KEY e LOJA_EMAIL_FROM nada é enviado e o resto da loja segue igual: o
// comprador volta do checkout pro link e o criador pode copiar o link no painel.

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.LOJA_EMAIL_FROM);
}

async function send(to: string, mail: Email, replyTo?: string | null): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.LOJA_EMAIL_FROM,
      to: [to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/**
 * Manda o link de acesso pro comprador. Sem `force`, só uma vez por pedido (a marca é gravada
 * antes de enviar e desfeita se o envio falhar). Nunca lança erro: e-mail não pode travar a venda.
 */
export async function sendAccessEmail(orderId: string, opts: { force?: boolean } = {}): Promise<boolean> {
  if (!emailConfigured()) return false;
  let claimed = false;
  try {
    const order = opts.force ? await orderById(orderId) : await claimAccessEmail(orderId);
    claimed = !opts.force && Boolean(order);
    if (!order || order.status !== 'paid') return false;
    const [product, store] = await Promise.all([productFull(order.product_id), storeById(order.store_id)]);
    if (!product || !store) throw new Error('produto ou loja não encontrados');
    const mail = accessEmail({
      storeName: store.name,
      productTitle: product.title,
      kind: product.kind,
      accessUrl: `${siteUrl()}/acesso/${decrypt(order.access_token_enc)}`,
      expiresAt: order.expires_at ? new Date(order.expires_at) : null,
      buyerName: order.buyer_name,
      supportEmail: store.support_email,
    });
    await send(order.buyer_email, mail, store.support_email);
    if (opts.force) await markAccessEmail(order.id);
    return true;
  } catch (e) {
    console.error('[loja] e-mail do acesso:', (e as Error).message);
    if (claimed) await releaseAccessEmail(orderId).catch(() => {});
    return false;
  }
}

/** "Perdi meu link": manda os acessos ativos do e-mail. Sem compra ativa, não manda nada. */
export async function sendRecoveryEmail(email: string): Promise<void> {
  const orders = (await paidOrdersOfBuyer(email)).filter((o) => accessState(o).ok);
  if (!orders.length) return;
  const [products, stores] = await Promise.all([
    productsByIds([...new Set(orders.map((o) => o.product_id))]),
    storesByIds([...new Set(orders.map((o) => o.store_id))]),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const storeByIdMap = new Map(stores.map((s) => [s.id, s]));
  const site = siteUrl();
  const items = orders.flatMap((o) => {
    const product = productById.get(o.product_id);
    const store = storeByIdMap.get(o.store_id);
    if (!product || !store) return [];
    return [{
      storeName: store.name,
      productTitle: product.title,
      accessUrl: `${site}/acesso/${decrypt(o.access_token_enc)}`,
      expiresAt: o.expires_at ? new Date(o.expires_at) : null,
    }];
  });
  if (items.length) await send(email, recoveryEmail(items));
}
