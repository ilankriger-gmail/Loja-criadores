import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Renova a sessão do Supabase e manda quem não está logado de /vender pro login. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const devBypass = process.env.NODE_ENV !== 'production' && process.env.LOJA_DEV_BYPASS === '1';

  if (!user && !devBypass && request.nextUrl.pathname.startsWith('/vender')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/vender';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // só as telas que usam login; vitrine, produto e acesso do comprador não precisam de sessão
  matcher: ['/vender/:path*', '/login'],
};
