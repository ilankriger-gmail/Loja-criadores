import { createHmac } from 'node:crypto';
import { safeEqual } from './crypto';

// Mercado Pago no modelo marketplace: cada criador conecta a conta dele (OAuth), a venda cai
// direto nela e a plataforma recebe a taxa pelo marketplace_fee. Docs:
// https://www.mercadopago.com.br/developers/pt/docs/split-payments/integration-configuration/integrate-marketplace

const API = 'https://api.mercadopago.com';
const AUTH = 'https://auth.mercadopago.com.br/authorization';

export function mpConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_CLIENT_ID && process.env.MERCADOPAGO_CLIENT_SECRET);
}

export class MercadoPagoError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

async function mpFetch<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = (body && typeof body === 'object' && 'message' in body) ? String((body as { message: unknown }).message) : `HTTP ${res.status}`;
    throw new MercadoPagoError(`Mercado Pago: ${msg}`, res.status);
  }
  return body as T;
}

export function authorizeUrl(redirectUri: string, state: string): string {
  const u = new URL(AUTH);
  u.searchParams.set('client_id', process.env.MERCADOPAGO_CLIENT_ID!);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('platform_id', 'mp');
  u.searchParams.set('state', state);
  u.searchParams.set('redirect_uri', redirectUri);
  return u.toString();
}

export interface MpTokens {
  access_token: string;
  refresh_token: string;
  public_key: string;
  user_id: number;
  expires_in: number;
}

export function exchangeCode(code: string, redirectUri: string): Promise<MpTokens> {
  return mpFetch<MpTokens>('/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: process.env.MERCADOPAGO_CLIENT_ID,
      client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
}

export function refreshTokens(refreshToken: string): Promise<MpTokens> {
  return mpFetch<MpTokens>('/oauth/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: process.env.MERCADOPAGO_CLIENT_ID,
      client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
}

export interface PreferenceInput {
  orderId: string;
  productId: string;
  title: string;
  priceCents: number;
  feeCents: number;
  buyerEmail: string;
  buyerName: string | null;
  notificationUrl: string;
  returnUrl: string;
  storeName: string;
}

/** Corpo da preferência do Checkout Pro (Pix, cartão e boleto; a tela é em português). */
export function preferenceBody(p: PreferenceInput) {
  return {
    items: [{ id: p.productId, title: p.title.slice(0, 250), quantity: 1, unit_price: p.priceCents / 100, currency_id: 'BRL' }],
    payer: { email: p.buyerEmail, ...(p.buyerName ? { name: p.buyerName } : {}) },
    external_reference: p.orderId,
    marketplace_fee: p.feeCents / 100,
    notification_url: p.notificationUrl,
    back_urls: { success: p.returnUrl, pending: p.returnUrl, failure: p.returnUrl },
    auto_return: 'approved',
    statement_descriptor: p.storeName.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 13) || undefined,
    payment_methods: { installments: 12 },
  };
}

export async function createPreference(sellerToken: string, p: PreferenceInput): Promise<{ id: string; init_point: string }> {
  return mpFetch('/checkout/preferences', {
    method: 'POST',
    token: sellerToken,
    headers: { 'X-Idempotency-Key': p.orderId },
    body: JSON.stringify(preferenceBody(p)),
  });
}

export interface MpPayment {
  id: number;
  status: string;               // approved | pending | in_process | rejected | refunded | charged_back | cancelled
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  date_approved: string | null;
}

export function getPayment(sellerToken: string, paymentId: string): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`, { token: sellerToken });
}

/** Status do pedido que corresponde ao status do pagamento. null = não muda nada. */
export function orderStatusFor(mpStatus: string): 'paid' | 'refunded' | 'cancelled' | null {
  if (mpStatus === 'approved') return 'paid';
  if (mpStatus === 'refunded' || mpStatus === 'charged_back') return 'refunded';
  if (mpStatus === 'cancelled' || mpStatus === 'rejected') return 'cancelled';
  return null;
}

/**
 * Confere a assinatura do webhook (header x-signature: "ts=...,v1=...").
 * Manifesto: id:<data.id>;request-id:<x-request-id>;ts:<ts>;  (partes ausentes saem do texto)
 */
export function verifyWebhookSignature(opts: { signature: string | null; requestId: string | null; dataId: string | null; secret: string }): boolean {
  if (!opts.signature) return false;
  const parts = Object.fromEntries(opts.signature.split(',').map((kv) => {
    const i = kv.indexOf('=');
    return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
  }));
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const id = opts.dataId && /^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId;
  let manifest = '';
  if (id) manifest += `id:${id};`;
  if (opts.requestId) manifest += `request-id:${opts.requestId};`;
  manifest += `ts:${ts};`;
  const expected = createHmac('sha256', opts.secret).update(manifest).digest('hex');
  return safeEqual(expected, v1);
}
