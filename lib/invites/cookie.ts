import 'server-only';

import { cookies } from 'next/headers';

import { createClient } from '@/lib/supabase/server';

/**
 * O convite entre a chegada e o cadastro.
 *
 * Quem clica no link de alguém não vira usuário na hora: passa pela tela de
 * cadastro, às vezes por um desvio no Google, e só então existe uma sessão a
 * quem atribuir o convite. O @usuário de quem convidou precisa sobreviver a
 * essa viagem, e o único lugar que sobrevive a um redirecionamento externo é
 * um cookie.
 *
 * Ele é `httpOnly` e dura 30 dias: quem descobre o app hoje e cria a conta na
 * semana que vem ainda credita quem indicou.
 */

const COOKIE = 'p20x_convite';

/**
 * Quem grava o cookie é o proxy, em `lib/supabase/proxy.ts`.
 *
 * Não é uma escolha de estilo: durante a renderização de uma página o Next
 * recusa escrita de cookie, e o convite chega justamente por uma navegação —
 * `/convite/{usuario}`. O proxy responde a essa navegação e pode escrever.
 */

/**
 * Aplica o convite guardado, se houver.
 *
 * Chamada depois de a sessão existir. A função no banco é quem decide: ela
 * recusa convite para quem já tem padrinho, para quem convidou a si mesmo e
 * para @usuário que não existe. Aqui só se limpa o cookie depois — inclusive
 * quando é recusado, senão a tentativa se repetiria a cada acesso.
 */
export async function aplicarConvitePendente(): Promise<void> {
  const jar = await cookies();
  const username = jar.get(COOKIE)?.value;

  if (!username) return;

  try {
    const supabase = await createClient();
    await supabase.rpc('registrar_convite', { p_username: username });
  } catch {
    // um convite perdido não pode impedir alguém de entrar no app
  } finally {
    jar.delete(COOKIE);
  }
}
