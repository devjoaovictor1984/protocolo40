import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Flame, Users } from 'lucide-react';

import { Wordmark } from '@/components/brand/wordmark';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ButtonLink } from '@/components/ui/button-link';
import { getUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { avatarUrl, initialsOf } from '@/lib/storage/avatar';
import { createClient } from '@/lib/supabase/server';

/**
 * A porta de entrada de um convite.
 *
 * Mostra quem convidou antes de pedir qualquer coisa: um link que leva direto
 * ao formulário de cadastro não diz de quem veio, e a primeira pergunta de
 * quem clica é exatamente essa.
 *
 * Se o perfil de quem convidou for privado, a página não revela nada dele —
 * mas o convite continua valendo, porque o vínculo é gravado pelo banco, não
 * pelo que esta tela conseguiu mostrar.
 */

type Params = Promise<{ username: string }>;

export const metadata: Metadata = {
  title: 'Você foi convidado',
  robots: { index: false, follow: false },
};

export default async function ConvitePage({ params }: { params: Params }) {
  const { username } = await params;

  // o cookie do convite já foi gravado pelo proxy, que é onde é permitido
  // escrever cookie; aqui só se mostra de quem veio

  // quem já tem conta não precisa desta tela
  if (await getUser()) {
    redirect('/hoje');
  }

  const supabase = await createClient();

  // função dedicada em vez de um select: a RLS de perfil privado esconderia o
  // nome de quem convidou, e aqui a divulgação é deliberada — só nome e foto,
  // para quem já tem o link
  const { data } = await supabase.rpc('perfil_do_convite', { p_username: username });
  const perfil = data?.[0] ?? null;

  const nome = perfil?.full_name ?? perfil?.username ?? null;
  const foto = perfil ? avatarUrl(perfil, env.supabaseUrl) : null;

  return (
    <div className="pt-safe px-safe flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-6">
        <Wordmark />
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-5 py-8 text-center">
        {perfil ? (
          <div className="flex flex-col items-center gap-3">
            <Avatar className="size-20">
              {foto ? <AvatarImage src={foto} alt="" /> : null}
              <AvatarFallback className="text-xl font-bold">
                {initialsOf(perfil.full_name, perfil.username)}
              </AvatarFallback>
            </Avatar>

            <p className="text-lg">
              <strong>{nome}</strong> está te chamando para o P20X.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="bg-secondary text-muted-foreground flex size-16 items-center justify-center rounded-2xl">
              <Users aria-hidden className="size-7" />
            </span>
            <p className="text-lg">Você foi convidado para o P20X.</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-balance">
            20 minutos. Todos os dias.
          </h1>
          <p className="text-muted-foreground text-balance">
            Treine, registre e veja a evolução um dia de cada vez. Sem equipamento, sem academia,
            sem preparação.
          </p>
        </div>

        <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
          <li className="flex items-center gap-2">
            <Flame aria-hidden className="text-streak size-4 shrink-0" />
            Uma sequência que você não vai querer quebrar
          </li>
          <li className="flex items-center gap-2">
            <Users aria-hidden className="size-4 shrink-0" />
            E gente treinando junto, para não ser sozinho
          </li>
        </ul>

        <div className="flex w-full flex-col gap-2">
          <ButtonLink href="/cadastro" className="h-14 w-full text-base font-bold">
            CRIAR MINHA CONTA
          </ButtonLink>
          <ButtonLink href="/login" variant="ghost" className="h-11 w-full">
            Já tenho conta
          </ButtonLink>
        </div>

        <p className="text-muted-foreground text-xs text-balance">
          É de graça. Seus treinos, fotos e medidas são privados por padrão.
        </p>
      </main>
    </div>
  );
}
