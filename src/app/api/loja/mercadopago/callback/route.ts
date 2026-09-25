import { NextRequest, NextResponse } from 'next/server';
import { currentSeller } from '@/lib/loja/auth';
import { saveMpTokens, siteUrl, storeById } from '@/lib/loja/db';
import { verifyState } from '@/lib/loja/crypto';
import { exchangeCode } from '@/lib/loja/mercadopago';

/** Volta do Mercado Pago: troca o código pelos tokens do criador e guarda cifrado. */
export async function GET(request: NextRequest) {
  const site = siteUrl();
  const params = new URL(request.url).searchParams;
  const code = params.get('code');
  const storeId = verifyState(params.get('state') || '');
  const user = await currentSeller();
  const store = storeId ? await storeById(storeId) : null;
  // o state é assinado e a loja tem que ser de quem está logado: ninguém conecta a conta dele na loja alheia
  if (!code || !store || !user || store.owner_id !== user.id) return NextResponse.redirect(`${site}/vender?mp=erro`);
  try {
    await saveMpTokens(store.id, await exchangeCode(code, `${site}/api/loja/mercadopago/callback`));
    return NextResponse.redirect(`${site}/vender?mp=conectado`);
  } catch (e) {
    console.error('[loja] conectar Mercado Pago:', (e as Error).message);
    return NextResponse.redirect(`${site}/vender?mp=erro`);
  }
}
