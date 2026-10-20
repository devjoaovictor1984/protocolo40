import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { aplicarConvitePendente } from '@/lib/invites/cookie';
import { createClient } from '@/lib/supabase/server';

/**
 * Retorno do OAuth e dos links de e-mail.
 *
 * Troca o código pela sessão e devolve o usuário para onde ele estava indo.
 * O destino só é aceito se for um caminho interno — parâmetro de URL não pode
 * virar redirecionamento aberto para outro site.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next') ?? '/hoje';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/hoje';

  const errorDescription = searchParams.get('error_description');
  if (errorDescription) {
    return NextResponse.redirect(`${origin}/login?erro=oauth`);
  }

  /*
   * Dois formatos de link chegam aqui. O `code` (PKCE) só troca por sessão no
   * mesmo navegador que pediu, porque o verificador mora num cookie dele: quem
   * pedia a senha no computador e abria o e-mail no celular caía em
   * `erro=sessao`. O `token_hash` vale em qualquer aparelho — é o que o modelo
   * de e-mail do Supabase manda quando aponta para cá com
   * `?token_hash={{ .TokenHash }}&type=recovery`.
   */
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(`${origin}/login?erro=sem-codigo`);
  }

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });

  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=sessao`);
  }

  // agora existe sessão: se a pessoa chegou por um convite, é aqui que ele vale
  await aplicarConvitePendente();

  return NextResponse.redirect(`${origin}${next}`);
}
