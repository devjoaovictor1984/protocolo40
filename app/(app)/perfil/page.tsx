import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CalendarCheck,
  Camera,
  ChevronRight,
  Clock,
  Flame,
  Medal,
  Settings,
  Trophy,
} from 'lucide-react';

import { StatCard, StreakBadge } from '@/components/stats';
import { BadgeChip } from '@/features/badges/components/badge-spotlight';
import { PrivacyToggle } from '@/features/community/components/privacy-toggle';
import { contagens } from '@/features/community/repository';
import { Emblem } from '@/features/badges/components/emblem';
import { conquistasDoUsuario } from '@/features/badges/repository';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ButtonLink } from '@/components/ui/button-link';
import { requireSession } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { avatarUrl, initialsOf } from '@/lib/storage/avatar';
import { createClient } from '@/lib/supabase/server';
import { formatDay } from '@/services/calendar';

export const metadata: Metadata = { title: 'Perfil', robots: { index: false, follow: false } };

export default async function PerfilPage() {
  const { user, profile, settings } = await requireSession();
  const supabase = await createClient();

  const [{ data }, conquistas, rede] = await Promise.all([
    supabase.rpc('get_user_stats', { p_user: user.id }),
    conquistasDoUsuario(user.id),
    contagens(user.id),
  ]);

  const visivelNaComunidade =
    settings.profile_visibility === 'public' && settings.allow_followers;
  const stats = data?.[0] ?? {
    current_streak: 0,
    longest_streak: 0,
    total_days: 0,
    total_seconds: 0,
    last_workout: null,
  };

  const initials = initialsOf(profile.full_name, profile.username);
  const foto = avatarUrl(profile, env.supabaseUrl);
  const isPublic = settings.profile_visibility === 'public';

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex items-start gap-4">
        <Link
          href="/configuracoes/conta"
          aria-label="Trocar foto de perfil"
          className="relative shrink-0 rounded-full"
        >
          <Avatar className="size-16">
            {foto ? <AvatarImage src={foto} alt="" /> : null}
            <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
          <span
            aria-hidden
            className="bg-primary text-primary-foreground border-background absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full border-2"
          >
            <Camera className="size-3" />
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">
            {profile.full_name ?? profile.username}
          </h1>
          <p className="text-muted-foreground text-sm">@{profile.username}</p>

          {/* seguidores e seguindo levam à comunidade: é lá que os dois vivem */}
          <p className="mt-1 flex items-center gap-3 text-sm">
            <Link href="/comunidade" className="hover:text-foreground">
              <strong className="tnum">{rede.seguidores}</strong>{' '}
              <span className="text-muted-foreground">
                {rede.seguidores === 1 ? 'seguidor' : 'seguidores'}
              </span>
            </Link>
            <Link href="/comunidade" className="hover:text-foreground">
              <strong className="tnum">{rede.seguindo}</strong>{' '}
              <span className="text-muted-foreground">seguindo</span>
            </Link>
          </p>

          <StreakBadge days={stats.current_streak} className="mt-2" />
        </div>

        {/* a última insígnia ao lado do nome: identidade e prova, juntas */}
        {conquistas.conquistadas[0] ? (
          <BadgeChip
            emblem={conquistas.conquistadas[0].emblem}
            tier={conquistas.conquistadas[0].tier}
            nome={conquistas.conquistadas[0].name}
          />
        ) : null}

        <ButtonLink href="/configuracoes"
          variant="ghost"
          size="icon"
          aria-label="Configurações"
        >
          <Settings aria-hidden className="size-5" />
        </ButtonLink>
      </header>

      {profile.bio ? <p className="text-sm">{profile.bio}</p> : null}

      <section aria-label="Seus números" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={stats.total_days} unit="dias" label="Dias treinados" icon={CalendarCheck} />
        <StatCard
          value={Math.round(Number(stats.total_seconds) / 60)}
          unit="min"
          label="Tempo total"
          icon={Clock}
        />
        <StatCard value={stats.current_streak} unit="dias" label="Sequência atual" icon={Flame} />
        <StatCard value={stats.longest_streak} unit="dias" label="Maior sequência" icon={Trophy} />
      </section>

      <p className="text-muted-foreground text-sm">
        Protocolo iniciado em {formatDay(profile.protocol_started_on)}
        {stats.last_workout ? ` · último treino em ${formatDay(stats.last_workout)}` : ''}
      </p>

      {conquistas.conquistadas.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Insígnias
          </h2>
          {/* as mais recentes primeiro; a lista inteira fica em /conquistas */}
          <Link
            href="/conquistas"
            aria-label="Ver todas as conquistas"
            className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
          >
            {conquistas.conquistadas.slice(0, 8).map((badge) => (
              <span key={badge.slug} className="flex w-16 shrink-0 flex-col items-center gap-1">
                <Emblem emblem={badge.emblem} tier={badge.tier} className="size-12" />
                <span className="text-center text-[10px] leading-tight font-medium">
                  {badge.name}
                </span>
              </span>
            ))}
          </Link>
        </section>
      ) : null}

      <PrivacyToggle visivel={visivelNaComunidade} />

      <nav className="flex flex-col gap-2">
        <Link
          href="/conquistas"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <Medal aria-hidden className="text-primary size-5" />
          <span className="flex-1 font-medium">Conquistas</span>
          <span className="text-muted-foreground tnum text-sm">
            {conquistas.conquistadas.length}
          </span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

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
