import { NextResponse } from 'next/server';
import { currentSeller } from '@/lib/loja/auth';
import { siteUrl, storeByOwner } from '@/lib/loja/db';
import { signState } from '@/lib/loja/crypto';
import { authorizeUrl, mpConfigured } from '@/lib/loja/mercadopago';

/** Botão "Conectar Mercado Pago": manda o criador autorizar a plataforma na conta dele. */
export async function GET() {
  const site = siteUrl();
  const user = await currentSeller();
  if (!user) return NextResponse.redirect(`${site}/login?redirectTo=/vender`);
  if (!mpConfigured()) return NextResponse.redirect(`${site}/vender?mp=nao-configurado`);
  const store = await storeByOwner(user.id);
  if (!store) return NextResponse.redirect(`${site}/vender`);
  return NextResponse.redirect(authorizeUrl(`${site}/api/loja/mercadopago/callback`, signState(store.id)));
}
