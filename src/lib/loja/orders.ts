import 'server-only';
import { orderById, productFull, sellerAccessToken, updateOrder, type Order } from './db';
import { sendAccessEmail } from './email';
import { getPayment, orderStatusFor } from './mercadopago';
import { expiresAtFrom } from './rules';

/**
 * Busca o pagamento no Mercado Pago (com o token do criador) e atualiza o pedido.
 * O webhook só diz "olhe o pagamento X": quem decide é a resposta da API, então um aviso
 * falso não libera nada. Confere pedido, valor e moeda antes de liberar o acesso. Pedido pago
 * que ainda não recebeu o e-mail com o link recebe agora (o próximo aviso tenta de novo se falhar).
 */
export async function syncPayment(storeId: string, paymentId: string): Promise<Order | null> {
  const token = await sellerAccessToken(storeId);
  if (!token) throw new Error('loja sem Mercado Pago conectado');
  const payment = await getPayment(token, paymentId);
  if (!payment.external_reference) return null;

  const order = await orderById(payment.external_reference);
  if (!order || order.store_id !== storeId) return null;
  // outro pagamento já liberou este pedido: não troca pelo atual (ex.: 2ª tentativa recusada)
  if (order.mp_payment_id && order.mp_payment_id !== String(payment.id) && order.status === 'paid') return order;

  const next = orderStatusFor(payment.status);
  const amountOk = payment.currency_id === 'BRL' && Math.round(payment.transaction_amount * 100) === order.amount_cents;
  const patch: Parameters<typeof updateOrder>[1] = { mp_payment_id: String(payment.id), mp_status: payment.status };

  if (next === 'paid' && amountOk && order.status !== 'paid') {
    const product = await productFull(order.product_id);
    const paidAt = payment.date_approved ? new Date(payment.date_approved) : new Date();
    patch.status = 'paid';
    patch.paid_at = paidAt.toISOString();
    patch.expires_at = expiresAtFrom(paidAt, product?.access_days ?? null)?.toISOString() ?? null;
  } else if (next === 'paid' && !amountOk) {
    console.error(`[loja] pagamento ${payment.id} com valor diferente do pedido ${order.id}`);
  } else if (next === 'refunded' && order.status === 'paid') {
    patch.status = 'refunded';
  } else if (next === 'cancelled' && order.status === 'pending') {
    patch.status = 'cancelled';
  }

  await updateOrder(order.id, patch);
  const updated = { ...order, ...patch } as Order;
  if (updated.status === 'paid' && !updated.access_email_sent_at) await sendAccessEmail(order.id);
  return updated;
}

/** Venda fora do Mercado Pago (Pix direto, cortesia): o criador libera na mão. true = e-mail enviado. */
export async function grantManually(order: Order, accessDays: number | null): Promise<boolean> {
  const now = new Date();
  await updateOrder(order.id, {
    status: 'paid',
    paid_at: now.toISOString(),
    expires_at: expiresAtFrom(now, accessDays)?.toISOString() ?? null,
  });
  return sendAccessEmail(order.id);
}
