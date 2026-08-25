import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import { decidirRota, falhaTemporaria, temCookieDeSessao } from '@/lib/supabase/guard';
import type { Database } from '@/types/database';

/**
 * Renova a sessão a cada request e barra rotas privadas.
 *
 * Isto é conveniência de navegação, não autorização — quem autoriza é a RLS.
 * Um usuário que force a URL vê uma tela, mas não vê dado de ninguém. A regra
 * de quem entra onde está em `guard.ts`, testada à parte.
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

  /**
   * Leva para `destino` sem perder o que já foi escrito na resposta.
   *
   * Quando o token de acesso vence, o `getClaims()` abaixo troca o par de
   * tokens e o antigo morre — a rotação do Supabase invalida o token de
   * renovação assim que ele é usado. Um `NextResponse.redirect()` novo não
   * carrega esses cookies, e o navegador continuaria guardando o par velho.
   */
  const redirecionar = (destino: URL) => {
    const saida = NextResponse.redirect(destino);
    for (const cookie of response.cookies.getAll()) {
      saida.cookies.set(cookie);
    }
    return saida;
  };

  // getClaims() verifica a assinatura do token localmente, com as chaves
  // públicas do projeto. getUser() faria o mesmo com uma ida à rede de ~250ms
  // em toda navegação. Não troque por getSession(), que aceita o cookie sem
  // verificar assinatura nenhuma.
  const { data: claims, error } = await supabase.auth.getClaims();

  const { pathname, search } = request.nextUrl;

  /**
   * O convite chega pela URL e precisa sobreviver até existir uma sessão.
   *
   * Gravar aqui, e não na página, porque cookie só pode ser escrito em
   * resposta — durante a renderização de um Server Component o Next recusa.
   * E é aqui também que ele sobrevive ao desvio pelo Google: `sameSite=lax`
   * mantém o cookie na volta do OAuth.
   */
  const convite = pathname.match(/^\/convite\/([a-zA-Z0-9_.-]{2,30})$/);
  if (convite) {
    response.cookies.set('p20x_convite', convite[1].toLowerCase(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  const decisao = decidirRota({
    pathname,
    busca: search,
    autenticado: Boolean(claims?.claims?.sub),
    temCookieDeSessao: temCookieDeSessao(
      request.cookies.getAll().map((c) => c.name),
      env.supabaseUrl,
    ),
    // A diferença entre "não tem sessão" e "não deu para perguntar". Confundir
    // as duas é o que fazia gente logada cair na tela de login no primeiro
    // soluço de sinal — ou quando o Supabase respondia 429.
    verificacaoFalhou: falhaTemporaria(error),
  });

  if (decisao.tipo === 'pedir-login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('redirect', decisao.de);
    return redirecionar(url);
  }

  if (decisao.tipo === 'levar-ao-app') {
    const url = request.nextUrl.clone();
    url.pathname = '/hoje';
    url.search = '';
    return redirecionar(url);
  }

  return response;
}
