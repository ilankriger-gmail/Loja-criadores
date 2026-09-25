import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Volta do login (Google ou confirmação de e-mail): troca o código pela sessão. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const raw = searchParams.get('next') ?? '/vender';
  const next = raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : '/vender';
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?erro=login`);
}
