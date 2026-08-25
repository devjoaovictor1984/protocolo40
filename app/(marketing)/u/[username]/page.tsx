import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Flame } from 'lucide-react';

import { Wordmark } from '@/components/brand/wordmark';
import { StatCard } from '@/components/stats';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ButtonLink } from '@/components/ui/button-link';
import { env } from '@/lib/env';
import { Emblem } from '@/features/badges/components/emblem';
import { conquistasDoUsuario } from '@/features/badges/repository';
import { FollowButton } from '@/features/community/components/follow-button';
import { contagens, relacaoCom, vitrineDe } from '@/features/community/repository';
import { getUser } from '@/lib/auth/session';
import { avatarUrl, initialsOf } from '@/lib/storage/avatar';
import { createClient } from '@/lib/supabase/server';
import { daysBetween, formatDay } from '@/services/calendar';

/**
 * Perfil público.
 *
 * A RLS decide o que existe: se o perfil não for público, a consulta volta
 * vazia e a página é 404 — o servidor nunca chega a ver o dado para filtrar
 * depois. Sequência e treinos aparecem apenas se o dono liberou cada um.
 */

type Params = Promise<{ username: string }>;

async function loadProfile(username: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, username, full_name, bio, avatar_path, avatar_url, updated_at, protocol_started_on, showcase_before_id, showcase_after_id',
    )
    .eq('username', username.toLowerCase())
    .maybeSingle();

  return profile;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);

  if (!profile) {
    // perfil privado ou inexistente: não vaza nem a existência da conta
    return { title: 'Perfil não encontrado', robots: { index: false, follow: false } };
  }

  const name = profile.full_name ?? profile.username;

  return {
    title: `${name} no P20X`,
    description: profile.bio ?? `${name} está construindo consistência, 20 minutos por dia.`,
    alternates: { canonical: `/u/${profile.username}` },
    openGraph: {
      type: 'profile',
      url: `/u/${profile.username}`,
      title: `${name} no P20X`,
      description: profile.bio ?? '20 minutos. Todos os dias.',
    },
  };
}

export default async function PerfilPublicoPage({ params }: { params: Params }) {
  const { username } = await params;
  const profile = await loadProfile(username);

  if (!profile) {
    notFound();
  }

  const supabase = await createClient();
  const visitante = await getUser();

  // a função é SECURITY INVOKER: sem permissão, os números voltam zerados
  const [{ data }, conquistas, numeros, vitrine, relacao] = await Promise.all([
    supabase.rpc('get_user_stats', { p_user: profile.id }),
    conquistasDoUsuario(profile.id),
    contagens(profile.id),
    vitrineDe(profile),
    visitante && visitante.id !== profile.id
      ? relacaoCom(profile.id)
      : Promise.resolve({ segue: false, status: null, meSegue: false }),
  ]);

  const stats = data?.[0] ?? null;
  const ehVisitanteLogado = Boolean(visitante) && visitante!.id !== profile.id;
  const name = profile.full_name ?? profile.username;
  const initials = initialsOf(profile.full_name, profile.username);
  const foto = avatarUrl(profile, env.supabaseUrl);

  return (
    <div className="pt-safe px-safe flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-6">
        {/*
          Esta página é pública, mas quem mais chega aqui já tem conta: veio da
          Comunidade ver o perfil de alguém. Para essa pessoa a marca leva de
          volta ao painel, e não à landing — sair do app e dar de cara com um
          botão "Entrar" parece que a sessão caiu.
        */}
        <Wordmark href={visitante ? '/hoje' : '/'} />
        {visitante ? (
          <ButtonLink href="/comunidade" variant="ghost" size="sm">
            Voltar
          </ButtonLink>
        ) : (
          <ButtonLink href="/cadastro" size="sm">
            Começar meu protocolo
          </ButtonLink>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-5 py-8">
        <div className="flex items-center gap-4">
          <Avatar className="size-20">
            {foto ? <AvatarImage src={foto} alt="" /> : null}
            <AvatarFallback className="text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{name}</h1>
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
            <p className="text-muted-foreground tnum mt-1 text-xs">
              {numeros.seguidores} {numeros.seguidores === 1 ? 'seguidor' : 'seguidores'} ·{' '}
              {numeros.seguindo} seguindo
            </p>
          </div>

          {ehVisitanteLogado ? (
            <FollowButton
              userId={profile.id}
              username={profile.username}
              seguindo={relacao.segue}
              compacto
            />
          ) : null}
        </div>

        {profile.bio ? <p>{profile.bio}</p> : null}

        {vitrine ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Antes e depois
            </h2>

            <div className="grid grid-cols-2 gap-2">
              {[
                { url: vitrine.antes, dia: vitrine.antesEm, rotulo: 'Antes' },
                { url: vitrine.depois, dia: vitrine.depoisEm, rotulo: 'Depois' },
              ].map((foto) => (
                <figure key={foto.rotulo} className="flex flex-col gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de curta duração */}
                  <img
                    src={foto.url}
                    alt={`${foto.rotulo}: ${formatDay(foto.dia)}`}
                    className="border-border aspect-3/4 w-full rounded-xl border object-cover"
                  />
                  <figcaption className="text-muted-foreground tnum text-center text-[11px]">
                    {foto.rotulo} · {formatDay(foto.dia)}
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="text-muted-foreground text-center text-[11px]">
              {daysBetween(vitrine.antesEm, vitrine.depoisEm)} dias entre as duas
            </p>
          </section>
        ) : null}

        {conquistas.conquistadas.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Insígnias ({conquistas.conquistadas.length})
            </h2>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {conquistas.conquistadas.slice(0, 12).map((badge) => (
                <span key={badge.slug} className="flex w-16 shrink-0 flex-col items-center gap-1">
                  <Emblem emblem={badge.emblem} tier={badge.tier} className="size-12" />
                  <span className="text-center text-[10px] leading-tight font-medium">
                    {badge.name}
                  </span>
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {stats && stats.total_days > 0 ? (
          <>
            <section className="grid grid-cols-3 gap-4">
              <StatCard value={stats.total_days} unit="dias" label="Dias treinados" />
              <StatCard value={stats.current_streak} unit="dias" label="Sequência" icon={Flame} />
              <StatCard value={stats.longest_streak} unit="dias" label="Maior sequência" />
            </section>

            {stats.current_streak > 0 ? (
              <p className="text-streak flex items-center gap-2 font-semibold">
                <Flame aria-hidden className="size-5" />
                {stats.current_streak} {stats.current_streak === 1 ? 'dia seguido' : 'dias seguidos'}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Este perfil não compartilha estatísticas.
          </p>
        )}

        <p className="text-muted-foreground text-sm">
          No P20X desde {formatDay(profile.protocol_started_on)}
        </p>

        {/* o convite para criar conta é para quem ainda não tem uma */}
        {visitante ? null : (
          <section className="border-border mt-auto rounded-2xl border p-6 text-center">
            <p className="text-xl font-extrabold tracking-tight text-balance">
              20 minutos. Todos os dias.
            </p>
            <p className="text-muted-foreground mt-2 text-sm text-balance">
              Treine, registre e acompanhe sua evolução um dia de cada vez.
            </p>
            <ButtonLink href="/cadastro" className="mt-4 h-12 w-full font-semibold">
              COMEÇAR MEU PROTOCOLO
            </ButtonLink>
          </section>
        )}
      </main>
    </div>
  );
}
