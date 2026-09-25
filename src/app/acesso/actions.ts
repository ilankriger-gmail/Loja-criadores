'use server';

import { headers } from 'next/headers';
import { withinLimit } from '@/lib/loja/db';
import { emailConfigured, sendRecoveryEmail } from '@/lib/loja/email';
import { clientIp, isEmail } from '@/lib/loja/rules';

export type RecoverState = { ok?: boolean; error?: string };

/**
 * "Perdi meu link": manda pro e-mail os acessos ativos dele. A resposta é a mesma com ou sem
 * compra (não revela quem comprou) e os links só chegam na caixa do dono do e-mail.
 */
export async function recoverAccessAction(_: RecoverState, form: FormData): Promise<RecoverState> {
  const raw = form.get('email');
  const email = typeof raw === 'string' ? raw.trim().toLowerCase().slice(0, 254) : '';
  if (!isEmail(email)) return { error: 'Confira o seu e-mail.' };
  if (!emailConfigured()) return { error: 'O envio por e-mail ainda não está ativo. Fale com o criador da loja em que você comprou.' };

  const ip = clientIp(await headers());
  const [ipOk, emailOk] = await Promise.all([ip ? withinLimit('recuperar-ip', ip) : true, withinLimit('recuperar-email', email)]);
  if (!ipOk || !emailOk) return { error: 'Muitos pedidos seguidos. Confira a caixa de spam ou tente de novo daqui a uma hora.' };

  try {
    await sendRecoveryEmail(email);
    return { ok: true };
  } catch (e) {
    console.error('[loja] recuperar acesso:', (e as Error).message);
    return { error: 'Não consegui enviar agora. Tente de novo em instantes.' };
  }
}
