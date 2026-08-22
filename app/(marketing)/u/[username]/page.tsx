import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flame } from 'lucide-react';

import { Wordmark } from '@/components/brand/wordmark';
import { StatCard } from '@/components/stats';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { formatDay } from '@/services/calendar';

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
    .select('id, username, full_name, bio, avatar_url, protocol_started_on')
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
    title: `${name} no PROTOCOLO40`,
    description: profile.bio ?? `${name} está construindo consistência, 20 minutos por dia.`,
    alternates: { canonical: `/u/${profile.username}` },
    openGraph: {
      type: 'profile',
      url: `/u/${profile.username}`,
      title: `${name} no PROTOCOLO40`,
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

  // a função é SECURITY INVOKER: sem permissão, os números voltam zerados
  const { data } = await supabase.rpc('get_user_stats', { p_user: profile.id });
  const stats = data?.[0] ?? null;
  const name = profile.full_name ?? profile.username;
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-6">
        <Wordmark />
        <Button render={<Link href="/cadastro" />} size="sm">
          Começar meu protocolo
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-5 py-8">
        <div className="flex items-center gap-4">
          <Avatar className="size-20">
            {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
            <AvatarFallback className="text-xl font-bold">{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{name}</h1>
            <p className="text-muted-foreground text-sm">@{profile.username}</p>
          </div>
        </div>

        {profile.bio ? <p>{profile.bio}</p> : null}

        {stats && stats.total_days > 0 ? (
          <>
            <section className="grid grid-cols-3 gap-4">
              <StatCard value={stats.total_days} label="dias treinados" />
              <StatCard value={stats.current_streak} label="sequência" />
              <StatCard value={stats.longest_streak} label="maior sequência" />
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
          No PROTOCOLO40 desde {formatDay(profile.protocol_started_on)}
        </p>

        <section className="border-border mt-auto rounded-2xl border p-6 text-center">
          <p className="text-xl font-extrabold tracking-tight text-balance">
            20 minutos. Todos os dias.
          </p>
          <p className="text-muted-foreground mt-2 text-sm text-balance">
            Treine, registre e acompanhe sua evolução um dia de cada vez.
          </p>
          <Button
            render={<Link href="/cadastro" />}
            className="mt-4 h-12 w-full font-semibold"
          >
            COMEÇAR MEU PROTOCOLO
          </Button>
        </section>
      </main>
    </div>
  );
}
