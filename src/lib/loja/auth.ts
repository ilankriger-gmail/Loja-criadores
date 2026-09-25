import 'server-only';
import { createClient } from '@/lib/supabase/server';

/** Só no desenvolvimento local: LOJA_DEV_BYPASS=1 abre o painel sem login. Nunca vale em produção. */
export function devBypass(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.LOJA_DEV_BYPASS === '1';
}

// Painel do vendedor: qualquer pessoa logada pode abrir a própria loja. Cada um só enxerga e mexe na loja em que owner_id = o próprio id.

export class SellerAuthError extends Error {}

export async function currentSeller(): Promise<{ id: string; email?: string } | null> {
  if (devBypass()) return { id: process.env.LOJA_DEV_USER_ID || '00000000-0000-0000-0000-000000000000', email: 'dev@localhost' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? undefined } : null;
}

export async function requireSeller(): Promise<{ id: string; email?: string }> {
  const user = await currentSeller();
  if (!user) throw new SellerAuthError('Faça login para continuar.');
  return user;
}
