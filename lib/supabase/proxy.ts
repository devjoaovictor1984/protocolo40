import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/** Prefixos que exigem sessão. */
const PRIVATE_PREFIXES = [
  '/app',
  '/onboarding',
  '/treino',
  '/treinos',
  '/historico',
  '/calendario',
  '/evolucao',
  '/medidas',
  '/recordes',
  '/comunidade',
  '/perfil',
  '/configuracoes',
];

/** Rotas que não fazem sentido para quem já está logado. */
const AUTH_ONLY_PREFIXES = ['/login', '/cadastro', '/esqueci-senha'];

const isUnder = (pathname: string, prefixes: string[]) =>
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

/**
 * Renova a sessão a cada request e barra rotas privadas.
 *
 * Isto é conveniência de navegação, não autorização — quem autoriza é a RLS.
 * Um usuário que force a URL vê uma tela, mas não vê dado de ninguém.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalida o token no servidor. Não troque por getSession() aqui:
  // getSession() confia no cookie sem verificar a assinatura.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && isUnder(pathname, PRIVATE_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('redirect', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (user && isUnder(pathname, AUTH_ONLY_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = '/app';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
