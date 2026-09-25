import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { decrypt, encrypt, hashToken } from './crypto';
import { refreshTokens } from './mercadopago';
import { LIMITS, type LimitKind, type ProductKind } from './rules';

// Acesso ao banco da Loja (Supabase, tabelas loja_*). Sempre pela service role: quem chama
// já conferiu o dono da loja (painel) ou o link de acesso (comprador).

export interface Store {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  instagram: string | null;
  support_email: string | null;
  fee_bps: number;
  mp_user_id: string | null;
  mp_connected_at: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  slug: string;
  kind: ProductKind;
  title: string;
  headline: string | null;
  description: string | null;
  price_cents: number;
  access_days: number | null;
  published: boolean;
  welcome: string | null;
  ai_enabled: boolean;
  ai_instructions: string | null;
  ai_knowledge: string | null;
  ai_messages_limit: number;
  download_url: string | null;
  position: number;
  created_at: string;
}

export interface Lesson {
  id: string;
  product_id: string;
  position: number;
  title: string;
  video_url: string | null;
  body: string | null;
}

export interface Order {
  id: string;
  store_id: string;
  product_id: string;
  buyer_email: string;
  buyer_name: string | null;
  amount_cents: number;
  fee_cents: number;
  status: 'pending' | 'paid' | 'refunded' | 'cancelled';
  source: string;
  mp_payment_id: string | null;
  mp_status: string | null;
  access_token_enc: string;
  paid_at: string | null;
  expires_at: string | null;
  messages_used: number;
  access_email_sent_at: string | null;
  created_at: string;
}

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

const STORE_COLS = 'id, owner_id, slug, name, bio, avatar_url, instagram, support_email, fee_bps, mp_user_id, mp_connected_at, created_at';
/** Colunas públicas do produto (sem o material da IA nem o link do download). */
const PRODUCT_PUBLIC_COLS = 'id, store_id, slug, kind, title, headline, description, price_cents, access_days, published, ai_enabled, position, created_at';

export class LojaError extends Error {}

function db() {
  return createServiceClient();
}

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) {
    if (/loja_/.test(res.error.message) && /does not exist|schema cache/.test(res.error.message)) {
      throw new LojaError('O banco da Loja está desatualizado: rode os arquivos de supabase/ em ordem no Supabase.');
    }
    throw new Error(`[loja] ${what}: ${res.error.message}`);
  }
  return res.data;
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

// ---------- lojas ----------

export async function storeByOwner(ownerId: string): Promise<Store | null> {
  return check(await db().from('loja_stores').select(STORE_COLS).eq('owner_id', ownerId).maybeSingle(), 'loja do dono') as Store | null;
}

export async function storeBySlug(slug: string): Promise<Store | null> {
  return check(await db().from('loja_stores').select(STORE_COLS).eq('slug', slug).maybeSingle(), 'loja pelo endereço') as Store | null;
}

export async function storeById(id: string): Promise<Store | null> {
  return check(await db().from('loja_stores').select(STORE_COLS).eq('id', id).maybeSingle(), 'loja') as Store | null;
}

export async function storesByIds(ids: string[]): Promise<Store[]> {
  if (!ids.length) return [];
  return check(await db().from('loja_stores').select(STORE_COLS).in('id', ids), 'lojas') as Store[];
}

export async function createStore(input: Pick<Store, 'owner_id' | 'slug' | 'name' | 'bio' | 'avatar_url' | 'instagram' | 'support_email' | 'fee_bps'>): Promise<Store> {
  const res = await db().from('loja_stores').insert(input).select(STORE_COLS).single();
  if (res.error && /duplicate key/.test(res.error.message)) {
    throw new LojaError(/owner/.test(res.error.message) ? 'Você já tem uma loja.' : 'Esse endereço já é de outra loja. Escolha outro.');
  }
  return check(res, 'criar loja') as Store;
}

export async function updateStore(id: string, patch: Partial<Pick<Store, 'slug' | 'name' | 'bio' | 'avatar_url' | 'instagram' | 'support_email'>>): Promise<void> {
  const res = await db().from('loja_stores').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (res.error && /duplicate key/.test(res.error.message)) throw new LojaError('Esse endereço já é de outra loja. Escolha outro.');
  check(res, 'atualizar loja');
}

export async function saveMpTokens(storeId: string, t: { access_token: string; refresh_token: string; public_key: string; user_id: number; expires_in: number }): Promise<void> {
  check(await db().from('loja_stores').update({
    mp_user_id: String(t.user_id),
    mp_public_key: t.public_key,
    mp_access_token_enc: encrypt(t.access_token),
    mp_refresh_token_enc: encrypt(t.refresh_token),
    mp_token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    mp_connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', storeId), 'salvar Mercado Pago');
}

export async function disconnectMp(storeId: string): Promise<void> {
  check(await db().from('loja_stores').update({
    mp_user_id: null, mp_public_key: null, mp_access_token_enc: null, mp_refresh_token_enc: null,
    mp_token_expires_at: null, mp_connected_at: null, updated_at: new Date().toISOString(),
  }).eq('id', storeId), 'desconectar Mercado Pago');
}

/** Token do Mercado Pago do criador, renovado se faltar menos de 7 dias pra vencer. */
export async function sellerAccessToken(storeId: string): Promise<string | null> {
  const row = check(await db().from('loja_stores')
    .select('mp_access_token_enc, mp_refresh_token_enc, mp_token_expires_at').eq('id', storeId).maybeSingle(), 'token do Mercado Pago') as
    { mp_access_token_enc: string | null; mp_refresh_token_enc: string | null; mp_token_expires_at: string | null } | null;
  if (!row?.mp_access_token_enc) return null;
  const expires = row.mp_token_expires_at ? new Date(row.mp_token_expires_at).getTime() : 0;
  if (row.mp_refresh_token_enc && expires - Date.now() < 7 * 86_400_000) {
    try {
      const t = await refreshTokens(decrypt(row.mp_refresh_token_enc));
      await saveMpTokens(storeId, t);
      return t.access_token;
    } catch (e) {
      console.error('[loja] renovar token do Mercado Pago:', (e as Error).message);
      if (expires < Date.now()) return null;
    }
  }
  return decrypt(row.mp_access_token_enc);
}

// ---------- produtos ----------

export async function productsOfStore(storeId: string, opts: { onlyPublished?: boolean } = {}): Promise<Product[]> {
  let q = db().from('loja_products').select(opts.onlyPublished ? PRODUCT_PUBLIC_COLS : '*').eq('store_id', storeId);
  if (opts.onlyPublished) q = q.eq('published', true);
  return check(await q.order('position').order('created_at'), 'produtos') as unknown as Product[];
}

export async function productBySlug(storeId: string, slug: string): Promise<Product | null> {
  return check(await db().from('loja_products').select(PRODUCT_PUBLIC_COLS).eq('store_id', storeId).eq('slug', slug).maybeSingle(), 'produto') as unknown as Product | null;
}

/** Produto completo (com material da IA e link do download): só pro dono ou pra quem comprou. */
export async function productFull(id: string): Promise<Product | null> {
  return check(await db().from('loja_products').select('*').eq('id', id).maybeSingle(), 'produto') as Product | null;
}

/** Vários produtos sem o material da IA (que pode ter centenas de milhares de caracteres). */
export async function productsByIds(ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  return check(await db().from('loja_products').select(PRODUCT_PUBLIC_COLS).in('id', ids), 'produtos') as unknown as Product[];
}

export type ProductWrite = Omit<Product, 'id' | 'store_id' | 'created_at' | 'position'>;

export async function saveProduct(storeId: string, id: string | null, input: ProductWrite): Promise<string> {
  const row = { ...input, store_id: storeId, updated_at: new Date().toISOString() };
  const res = id
    ? await db().from('loja_products').update(row).eq('id', id).eq('store_id', storeId).select('id').single()
    : await db().from('loja_products').insert(row).select('id').single();
  if (res.error && /duplicate key/.test(res.error.message)) throw new LojaError('Você já tem um produto com esse endereço.');
  return (check(res, 'salvar produto') as { id: string }).id;
}

export async function deleteProduct(storeId: string, id: string): Promise<void> {
  const res = await db().from('loja_products').delete().eq('id', id).eq('store_id', storeId);
  if (res.error && /foreign key/.test(res.error.message)) throw new LojaError('Esse produto já tem vendas: despublique em vez de apagar.');
  check(res, 'apagar produto');
}

export async function lessonsOf(productId: string): Promise<Lesson[]> {
  return check(await db().from('loja_lessons').select('*').eq('product_id', productId).order('position'), 'aulas') as Lesson[];
}

export async function replaceLessons(productId: string, lessons: { title: string; video_url: string | null; body: string | null }[]): Promise<void> {
  check(await db().from('loja_lessons').delete().eq('product_id', productId), 'limpar aulas');
  if (!lessons.length) return;
  check(await db().from('loja_lessons').insert(lessons.map((l, i) => ({ ...l, product_id: productId, position: i }))), 'gravar aulas');
}

// ---------- pedidos ----------

export async function createOrder(input: {
  store_id: string; product_id: string; buyer_email: string; buyer_name: string | null;
  amount_cents: number; fee_cents: number; access_token: string; source?: string;
}): Promise<Order> {
  const { access_token, ...rest } = input;
  return check(await db().from('loja_orders').insert({
    ...rest,
    access_token_hash: hashToken(access_token),
    access_token_enc: encrypt(access_token),
    consent_at: new Date().toISOString(),
  }).select('*').single(), 'criar pedido') as Order;
}

export async function setOrderPreference(orderId: string, preferenceId: string): Promise<void> {
  check(await db().from('loja_orders').update({ mp_preference_id: preferenceId }).eq('id', orderId), 'preferência do pedido');
}

export async function orderByToken(token: string): Promise<Order | null> {
  return check(await db().from('loja_orders').select('*').eq('access_token_hash', hashToken(token)).maybeSingle(), 'pedido') as Order | null;
}

export async function orderById(id: string): Promise<Order | null> {
  return check(await db().from('loja_orders').select('*').eq('id', id).maybeSingle(), 'pedido') as Order | null;
}

export async function ordersOfStore(storeId: string, limit = 100): Promise<Order[]> {
  return check(await db().from('loja_orders').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(limit), 'pedidos') as Order[];
}

/** Compras pagas de um e-mail, em todas as lojas (pra reenviar os links). */
export async function paidOrdersOfBuyer(email: string, limit = 50): Promise<Order[]> {
  return check(await db().from('loja_orders').select('*').eq('buyer_email', email).eq('status', 'paid')
    .order('created_at', { ascending: false }).limit(limit), 'compras do e-mail') as Order[];
}

export async function updateOrder(id: string, patch: Partial<Pick<Order, 'status' | 'mp_payment_id' | 'mp_status' | 'paid_at' | 'expires_at'>>): Promise<void> {
  check(await db().from('loja_orders').update(patch).eq('id', id), 'atualizar pedido');
}

/**
 * Reserva o envio do e-mail de acesso: marca a hora e devolve o pedido só se estava pago e sem
 * e-mail. Dois avisos chegando juntos (webhook e volta do checkout) → só um ganha.
 */
export async function claimAccessEmail(orderId: string): Promise<Order | null> {
  return check(await db().from('loja_orders').update({ access_email_sent_at: new Date().toISOString() })
    .eq('id', orderId).eq('status', 'paid').is('access_email_sent_at', null).select('*').maybeSingle(), 'reservar e-mail') as Order | null;
}

/** O envio falhou: libera pra tentar de novo no próximo aviso. */
export async function releaseAccessEmail(orderId: string): Promise<void> {
  check(await db().from('loja_orders').update({ access_email_sent_at: null }).eq('id', orderId), 'liberar e-mail');
}

export async function markAccessEmail(orderId: string): Promise<void> {
  check(await db().from('loja_orders').update({ access_email_sent_at: new Date().toISOString() }).eq('id', orderId), 'marcar e-mail');
}

/** Gasta uma mensagem da IA. false = acabou o saldo (ou o pedido não está pago). */
export async function spendMessage(orderId: string, limit: number): Promise<boolean> {
  const res = await db().rpc('loja_use_message', { p_order: orderId, p_limit: limit });
  const data = check(res, 'saldo da IA') as number | number[] | null;
  return Array.isArray(data) ? data.length > 0 : data != null;
}

/** A IA não respondeu: devolve a mensagem gasta. */
export async function refundMessage(orderId: string): Promise<void> {
  check(await db().rpc('loja_refund_message', { p_order: orderId }), 'devolver mensagem da IA');
}

/**
 * Conta uma tentativa (IP ou e-mail, guardado só o hash) e diz se ainda está dentro do limite.
 * Se o banco falhar, deixa passar: limite é proteção extra, não pode derrubar venda.
 */
export async function withinLimit(kind: LimitKind, value: string): Promise<boolean> {
  const [max, windowSeconds] = LIMITS[kind];
  try {
    const res = await db().rpc('loja_rate_hit', { p_key: `${kind}:${hashToken(value).slice(0, 32)}`, p_max: max, p_window_seconds: windowSeconds });
    if (res.error) throw new Error(res.error.message);
    return res.data !== false;
  } catch (e) {
    console.error('[loja] limite de tentativas:', (e as Error).message);
    return true;
  }
}

export async function chatHistory(orderId: string, limit = 40): Promise<ChatMessage[]> {
  const rows = check(await db().from('loja_chat_messages').select('role, content').eq('order_id', orderId)
    .order('id', { ascending: false }).limit(limit), 'conversa') as ChatMessage[];
  return rows.reverse();
}

export async function appendChat(orderId: string, messages: ChatMessage[]): Promise<void> {
  check(await db().from('loja_chat_messages').insert(messages.map((m) => ({ ...m, order_id: orderId }))), 'gravar conversa');
}
