import { NextRequest, NextResponse } from 'next/server';
import { storeById } from '@/lib/loja/db';
import { verifyWebhookSignature } from '@/lib/loja/mercadopago';
import { syncPayment } from '@/lib/loja/orders';

/**
 * Aviso do Mercado Pago (notification_url de cada preferência). Com MERCADOPAGO_WEBHOOK_SECRET
 * a assinatura é conferida; de qualquer jeito o pagamento é buscado na API com o token do
 * criador antes de liberar qualquer acesso.
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({})) as { type?: string; topic?: string; data?: { id?: string | number } };
  const type = body.type || body.topic || url.searchParams.get('type') || url.searchParams.get('topic');
  const dataId = url.searchParams.get('data.id') || (body.data?.id != null ? String(body.data.id) : null) || url.searchParams.get('id');
  if (type !== 'payment' || !dataId) return NextResponse.json({ ok: true, ignored: true });

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (secret && !verifyWebhookSignature({
    signature: request.headers.get('x-signature'),
    requestId: request.headers.get('x-request-id'),
    dataId,
    secret,
  })) {
    return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 });
  }

  const storeId = url.searchParams.get('store');
  if (!storeId || !/^[\da-f-]{36}$/i.test(storeId) || !(await storeById(storeId))) return NextResponse.json({ ok: true, ignored: true });
  try {
    await syncPayment(storeId, dataId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    // 500 faz o Mercado Pago tentar de novo mais tarde
    console.error('[loja] webhook:', (e as Error).message);
    return NextResponse.json({ error: 'falhou' }, { status: 500 });
  }
}
