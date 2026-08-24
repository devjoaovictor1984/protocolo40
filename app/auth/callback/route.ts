import { NextResponse, type NextRequest } from 'next/server';

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

  if (!code) {
    return NextResponse.redirect(`${origin}/login?erro=sem-codigo`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=sessao`);
  }

  // agora existe sessão: se a pessoa chegou por um convite, é aqui que ele vale
  await aplicarConvitePendente();

  return NextResponse.redirect(`${origin}${next}`);
}
