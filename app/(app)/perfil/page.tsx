import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, Settings, Trophy } from 'lucide-react';

import { StatCard, StreakBadge } from '@/components/stats';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { requireSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDay } from '@/services/calendar';

export const metadata: Metadata = { title: 'Perfil', robots: { index: false, follow: false } };

export default async function PerfilPage() {
  const { user, profile, settings } = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase.rpc('get_user_stats', { p_user: user.id });
  const stats = data?.[0] ?? {
    current_streak: 0,
    longest_streak: 0,
    total_days: 0,
    total_seconds: 0,
    last_workout: null,
  };

  const initials = (profile.full_name ?? profile.username).slice(0, 2).toUpperCase();
  const isPublic = settings.profile_visibility === 'public';

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex items-start gap-4">
        <Avatar className="size-16">
          {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">
            {profile.full_name ?? profile.username}
          </h1>
          <p className="text-muted-foreground text-sm">@{profile.username}</p>
          <StreakBadge days={stats.current_streak} className="mt-2" />
        </div>

        <Button
          render={<Link href="/configuracoes" />}
          variant="ghost"
          size="icon"
          aria-label="Configurações"
        >
          <Settings aria-hidden className="size-5" />
        </Button>
      </header>

      {profile.bio ? <p className="text-sm">{profile.bio}</p> : null}

      <section aria-label="Seus números" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard value={stats.total_days} label="dias treinados" />
        <StatCard value={Math.round(Number(stats.total_seconds) / 60)} label="minutos" />
        <StatCard value={stats.current_streak} label="sequência atual" />
        <StatCard value={stats.longest_streak} label="maior sequência" />
      </section>

      <p className="text-muted-foreground text-sm">
        Protocolo iniciado em {formatDay(profile.protocol_started_on)}
        {stats.last_workout ? ` · último treino em ${formatDay(stats.last_workout)}` : ''}
      </p>

      <nav className="flex flex-col gap-2">
        <Link
          href="/recordes"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <Trophy aria-hidden className="text-primary size-5" />
          <span className="flex-1 font-medium">Recordes</span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

        <Link
          href="/configuracoes/privacidade"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <span className="flex-1 font-medium">Privacidade</span>
          <span className="text-muted-foreground text-sm">
            {isPublic ? 'Perfil público' : 'Perfil privado'}
          </span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>
      </nav>

      {isPublic ? (
        <p className="text-muted-foreground text-sm">
          Seu perfil público está em{' '}
          <Link href={`/u/${profile.username}`} className="underline underline-offset-4">
            /u/{profile.username}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
