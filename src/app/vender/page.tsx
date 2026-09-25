import Link from 'next/link';
import { ExternalLink, Plus } from 'lucide-react';
import { currentSeller } from '@/lib/loja/auth';
import { LojaError, ordersOfStore, productsOfStore, siteUrl, storeByOwner, type Order, type Product } from '@/lib/loja/db';
import { decrypt } from '@/lib/loja/crypto';
import { mpConfigured } from '@/lib/loja/mercadopago';
import { formatBRL, KIND_LABEL } from '@/lib/loja/rules';
import { Card, CardHead, PageHeader, StateChip } from '@/components/loja/panel';
import { CopyButton, DeleteProduct, DisconnectMp, GiftForm, GrantOrder, StoreForm } from './forms';

export const dynamic = 'force-dynamic';

const MP_NOTICE: Record<string, { tone: 'ok' | 'crit' | 'warn'; text: string }> = {
  conectado: { tone: 'ok', text: 'Mercado Pago conectado. Sua loja já pode vender.' },
  erro: { tone: 'crit', text: 'Não consegui conectar o Mercado Pago. Tente de novo.' },
  'nao-configurado': { tone: 'warn', text: 'Os pagamentos ainda não foram ativados na plataforma (faltam as chaves do Mercado Pago).' },
};

const ORDER_TONE = { paid: 'ok', pending: 'warn', refunded: 'crit', cancelled: 'info' } as const;
const ORDER_LABEL = { paid: 'pago', pending: 'aguardando', refunded: 'reembolsado', cancelled: 'cancelado' } as const;

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function SellerPage({ searchParams }: Props) {
  const sp = await searchParams;
  const user = await currentSeller();
  if (!user) return null; // o proxy já manda pro login
  const site = siteUrl();

  let store;
  try {
    store = await storeByOwner(user.id);
  } catch (e) {
    if (e instanceof LojaError) return <Card><p className="text-crit">{e.message}</p></Card>;
    throw e;
  }

  if (!store) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Crie sua loja" sub="Um link só pra bio, com IA personalizada, curso e material pra baixar. Pagamento por Pix e cartão." />
        <Card className="mt-6"><StoreForm store={null} site={site} /></Card>
      </div>
    );
  }

  const [products, orders] = await Promise.all([productsOfStore(store.id), ordersOfStore(store.id, 100)]);
  const paid = orders.filter((o) => o.status === 'paid' && o.source !== 'manual');
  const gross = paid.reduce((s, o) => s + o.amount_cents, 0);
  const fees = paid.reduce((s, o) => s + o.fee_cents, 0);
  const buyers = new Set(orders.filter((o) => o.status === 'paid').map((o) => o.buyer_email)).size;
  const byId = new Map<string, Product>(products.map((p) => [p.id, p]));
  const storeUrl = `${site}/l/${store.slug}`;
  const notice = sp.mp ? MP_NOTICE[sp.mp] : null;
  const canSell = mpConfigured() && store.mp_connected_at;

  return (
    <div className="space-y-6">
      <PageHeader
        title={store.name}
        sub={<span className="inline-flex flex-wrap items-center gap-2">{storeUrl.replace(/^https?:\/\//, '')} <CopyButton text={storeUrl} /></span>}
        right={<a href={storeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10"><ExternalLink className="h-4 w-4" /> Ver loja</a>}
      />

      {notice && <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3 text-[14px]"><StateChip tone={notice.tone} />{notice.text}</div>}
      {sp.salvo && <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3 text-[14px]"><StateChip tone="ok" />Produto salvo.</div>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Vendido (últimos 100 pedidos)" value={formatBRL(gross)} />
        <Stat label="Taxa da plataforma" value={formatBRL(fees)} hint={`${(store.fee_bps / 100).toLocaleString('pt-BR')}% por venda`} />
        <Stat label="Você recebe" value={formatBRL(gross - fees)} hint="antes da tarifa do Mercado Pago" />
        <Stat label="Compradores" value={String(buyers)} />
      </div>

      <Card>
        <CardHead title="Recebimento" />
        {canSell ? (
          <p className="flex flex-wrap items-center gap-2 text-[14px] text-ink-2">
            <StateChip tone="ok">conectado</StateChip> As vendas caem direto na sua conta do Mercado Pago (Pix e cartão). <DisconnectMp />
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-[14px] text-ink-2">Conecte sua conta do Mercado Pago pra vender. O dinheiro cai direto na sua conta; a plataforma fica com {(store.fee_bps / 100).toLocaleString('pt-BR')}% de cada venda.</p>
            <a href="/api/loja/mercadopago/connect" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-[#c21f1f]">Conectar Mercado Pago</a>
          </div>
        )}
      </Card>

      <Card>
        <CardHead title="Produtos" right={<Link href="/vender/produtos/novo" className="inline-flex items-center gap-1 text-accent-ink hover:underline"><Plus className="h-3.5 w-3.5" /> Novo produto</Link>} />
        {products.length === 0 ? (
          <p className="text-[14px] text-muted">Nenhum produto ainda. <Link href="/vender/produtos/novo" className="text-accent-ink underline">Crie o primeiro</Link>: uma IA com o seu jeito, um curso ou um material pra baixar.</p>
        ) : (
          <ul className="divide-y divide-line">
            {products.map((p) => {
              const sold = orders.filter((o) => o.product_id === p.id && o.status === 'paid').length;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/vender/produtos/${p.id}`} className="font-medium hover:text-accent-ink">{p.title}</Link>
                    <p className="font-mono text-[11.5px] text-muted">{KIND_LABEL[p.kind]} · {formatBRL(p.price_cents)} · {sold} {sold === 1 ? 'venda' : 'vendas'}</p>
                  </div>
                  <StateChip tone={p.published ? 'ok' : 'info'}>{p.published ? 'publicado' : 'rascunho'}</StateChip>
                  {p.published && <CopyButton text={`${storeUrl}/${p.slug}`} />}
                  <DeleteProduct id={p.id} title={p.title} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHead title="Pedidos" right={`${orders.length} mais recentes`} />
        {orders.length === 0 ? <p className="text-[14px] text-muted">Nenhum pedido ainda.</p> : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead className="font-mono text-[11px] uppercase tracking-wide text-muted">
                <tr><th className="py-2 pr-3 font-medium">Quando</th><th className="py-2 pr-3 font-medium">Comprador</th><th className="py-2 pr-3 font-medium">Produto</th><th className="py-2 pr-3 text-right font-medium">Valor</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 font-medium">Acesso</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => <OrderRow key={o.id} order={o} product={byId.get(o.product_id)} site={site} />)}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {products.length > 0 && (
        <Card>
          <CardHead title="Dar acesso de cortesia" />
          <p className="mb-3 text-[13.5px] text-muted">Pra parceiro, sorteio ou pra testar como o comprador vê. Não passa pelo Mercado Pago.</p>
          <GiftForm products={products.map((p) => ({ id: p.id, title: p.title }))} />
        </Card>
      )}

      <Card>
        <CardHead title="Dados da loja" />
        <StoreForm store={store} site={site} />
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-3.5">
      <p className="font-mono text-[11px] text-muted">{label}</p>
      <p className="mt-1 font-display text-[22px] font-bold tabular-nums">{value}</p>
      {hint && <p className="font-mono text-[11px] text-faint">{hint}</p>}
    </Card>
  );
}

function OrderRow({ order: o, product, site }: { order: Order; product?: Product; site: string }) {
  let link: string | null = null;
  try { link = `${site}/acesso/${decrypt(o.access_token_enc)}`; } catch { link = null; }
  return (
    <tr>
      <td className="py-2 pr-3 font-mono text-[12px] text-muted whitespace-nowrap">{new Date(o.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
      <td className="py-2 pr-3"><span className="block max-w-[200px] truncate">{o.buyer_name || o.buyer_email}</span>{o.buyer_name && <span className="block max-w-[200px] truncate font-mono text-[11px] text-muted">{o.buyer_email}</span>}</td>
      <td className="py-2 pr-3"><span className="block max-w-[180px] truncate">{product?.title ?? '—'}</span></td>
      <td className="py-2 pr-3 text-right tabular-nums">{o.source === 'manual' && o.amount_cents === 0 ? 'cortesia' : formatBRL(o.amount_cents)}</td>
      <td className="py-2 pr-3"><StateChip tone={ORDER_TONE[o.status]}>{ORDER_LABEL[o.status]}</StateChip></td>
      <td className="py-2"><span className="flex gap-1.5">{o.status === 'paid' && link && <CopyButton text={link} />}{o.status === 'pending' && <GrantOrder id={o.id} />}</span></td>
    </tr>
  );
}
