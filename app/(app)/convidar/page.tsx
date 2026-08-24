import type { Metadata } from 'next';
import { UserPlus } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Emblem } from '@/features/badges/components/emblem';
import { conquistasDoUsuario } from '@/features/badges/repository';
import { InvitePanel } from '@/features/invites/components/invite-panel';
import { requireSession } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Convidar',
  robots: { index: false, follow: false },
};

export default async function ConvidarPage() {
  const { user, profile } = await requireSession();
  const supabase = await createClient();

  const [{ data: convites }, conquistas] = await Promise.all([
    supabase.rpc('contar_convites', { p_user: user.id }),
    conquistasDoUsuario(user.id),
  ]);

  const total = convites ?? 0;
  const link = `${env.siteUrl}/convite/${profile.username}`;
  const nome = (profile.full_name ?? profile.username).split(' ')[0];

  const doConvite = conquistas.todas.filter((badge) => badge.metric === 'convites');
  const proxima = doConvite.find((badge) => !badge.earned);

  return (
    <div className="flex flex-col gap-8 py-6">
      <PageHeader
        titulo="Convidar"
        descricao="Treinar sozinho funciona. Treinar sabendo que alguém está fazendo o mesmo dura mais."
        trilha={[{ href: '/comunidade', label: 'Comunidade' }]}
      />

      <InvitePanel link={link} nome={nome} />

      <section className="border-border flex items-center gap-4 rounded-2xl border p-4">
        <span className="bg-secondary text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-full">
          <UserPlus aria-hidden className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="tnum text-2xl font-extrabold">
            {total}
            <span className="text-muted-foreground ml-1.5 text-sm font-normal">
              {total === 1 ? 'pessoa entrou' : 'pessoas entraram'} pelo seu convite
            </span>
          </p>

          {proxima ? (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Faltam {proxima.threshold - total}{' '}
              {proxima.threshold - total === 1 ? 'pessoa' : 'pessoas'} para {proxima.name}.
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Você já tem todas as insígnias de convite.
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Insígnias de convite
        </h2>

        <ul className="grid grid-cols-3 gap-3">
          {doConvite.map((badge) => (
            <li
              key={badge.slug}
              className={cn(
                'flex flex-col items-center gap-2 rounded-2xl border p-3 text-center',
                badge.earned ? 'border-primary/30 bg-card' : 'border-border/60 bg-muted/30',
              )}
            >
              <Emblem emblem={badge.emblem} tier={badge.tier} earned={badge.earned} />
              <span
                className={cn('text-xs font-bold', !badge.earned && 'text-muted-foreground')}
              >
                {badge.name}
              </span>
              <span className="text-muted-foreground tnum text-[11px]">
                {badge.threshold} {badge.threshold === 1 ? 'convite' : 'convites'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-muted-foreground border-border rounded-xl border p-4 text-xs leading-relaxed">
        O convite conta quando a pessoa termina o cadastro — não basta abrir o link. E ele fica
        ligado a você para sempre: mesmo que ela crie a conta semanas depois, o crédito continua
        sendo seu.
      </p>
    </div>
  );
}
