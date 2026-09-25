import { NextRequest, NextResponse } from 'next/server';
import { createOrder, LojaError, productBySlug, sellerAccessToken, setOrderPreference, siteUrl, storeBySlug, updateOrder } from '@/lib/loja/db';
import { newAccessToken } from '@/lib/loja/crypto';
import { createPreference, MercadoPagoError, mpConfigured } from '@/lib/loja/mercadopago';
import { feeCents, isEmail } from '@/lib/loja/rules';

/**
 * Começa uma compra: cria o pedido (pendente) e a preferência do Checkout Pro na conta do
 * criador, com a taxa da plataforma em marketplace_fee. Devolve o endereço do pagamento.
 * O preço vem sempre do banco, nunca do navegador.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const str = (k: string, max: number) => (typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, max) : '');
  const email = str('email', 254).toLowerCase();
  const name = str('name', 120) || null;
  if (!isEmail(email)) return NextResponse.json({ error: 'Confira o seu e-mail.' }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: 'Aceite os termos para continuar.' }, { status: 400 });

  try {
    const store = await storeBySlug(str('store', 60));
    const product = store ? await productBySlug(store.id, str('product', 60)) : null;
    if (!store || !product || !product.published) return NextResponse.json({ error: 'Produto não encontrado.' }, { status: 404 });
    if (!mpConfigured()) return NextResponse.json({ error: 'Pagamentos ainda não estão ativos nesta plataforma.' }, { status: 503 });
    const sellerToken = await sellerAccessToken(store.id);
    if (!sellerToken) return NextResponse.json({ error: 'Esta loja ainda não está recebendo pagamentos.' }, { status: 503 });

    const token = newAccessToken();
    const fee = feeCents(product.price_cents, store.fee_bps);
    const order = await createOrder({
      store_id: store.id, product_id: product.id, buyer_email: email, buyer_name: name,
      amount_cents: product.price_cents, fee_cents: fee, access_token: token,
    });
    const site = siteUrl();
    try {
      const pref = await createPreference(sellerToken, {
        orderId: order.id,
        productId: product.id,
        title: product.title,
        priceCents: product.price_cents,
        feeCents: fee,
        buyerEmail: email,
        buyerName: name,
        notificationUrl: `${site}/api/loja/mercadopago/webhook?store=${store.id}`,
        returnUrl: `${site}/acesso/${token}`,
        storeName: store.name,
      });
      await setOrderPreference(order.id, pref.id);
      return NextResponse.json({ url: pref.init_point, access_url: `${site}/acesso/${token}` });
    } catch (e) {
      await updateOrder(order.id, { status: 'cancelled' });
      throw e;
    }
  } catch (e) {
    if (e instanceof LojaError) return NextResponse.json({ error: e.message }, { status: 503 });
    if (e instanceof MercadoPagoError) {
      console.error('[loja] checkout:', e.message);
      return NextResponse.json({ error: 'O Mercado Pago não respondeu. Tente de novo em instantes.' }, { status: 502 });
    }
    console.error('[loja] checkout:', e);
    return NextResponse.json({ error: 'Não consegui abrir o pagamento. Tente de novo.' }, { status: 500 });
  }
}
