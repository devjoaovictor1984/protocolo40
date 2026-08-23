'use client';

import Link from 'next/link';
import { Check, ChevronRight, ListChecks, Play, Timer } from 'lucide-react';

import { ProgressRing } from '@/components/progress-ring';
import { EmptyState, StatCard, StreakBadge } from '@/components/stats';
import { SyncStatus } from '@/components/sync-status';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboard } from '@/features/dashboard/use-dashboard';
import { useSession, useToday } from '@/features/session/session-context';
import { cn } from '@/lib/utils';
import { formatClock, formatDurationShort } from '@/services/duration';
import { greeting, monthLabel, monthGrid, relativeDay, WEEKDAY_LABELS, WEEKDAY_NAMES } from '@/services/calendar';
import type { LocalWorkout } from '@/types/offline';

/**
 * O dia de hoje.
 *
 * A tela responde a uma pergunta só: o que eu preciso fazer hoje? Por isso o
 * cartão do treino ocupa o topo e tudo o mais vem depois, em texto pequeno.
 */
export function Dashboard() {
  const { fullName, username, dailyGoalSeconds, timezone } = useSession();
  const today = useToday();
  const { data, isLoading } = useDashboard();

  const firstName = (fullName ?? username).split(' ')[0];
  const doneToday = (data?.todayWorkouts.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm">
              {greeting(timezone)}, {firstName}
            </p>
            {isLoading ? (
              <Skeleton className="mt-1 h-5 w-40" />
            ) : (
              <StreakBadge days={data?.streak.current ?? 0} size="lg" className="mt-1" />
            )}
          </div>
          <SyncStatus />
        </div>
      </header>

      {isLoading ? (
        <Skeleton className="h-80 w-full rounded-2xl" />
      ) : doneToday ? (
        <DoneCard workouts={data!.todayWorkouts} day={data!.protocolDay} />
      ) : (
        <TodayCard day={data?.protocolDay ?? 1} goalSeconds={dailyGoalSeconds} />
      )}

      {isLoading ? (
        <Skeleton className="h-44 w-full rounded-2xl" />
      ) : (
        <MonthStrip today={today} days={data!.days} />
      )}

      {!isLoading && data!.lastWorkout ? (
        <LastWorkout workout={data!.lastWorkout} today={today} />
      ) : null}

      {!isLoading && data!.workouts.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="Seu primeiro treino começa aqui."
          description="Vinte minutos. Sem equipamento, sem desculpa, sem preparação."
          action={
            <ButtonLink href="/treino/hoje?auto=1" size="lg" className="h-12">
              COMEÇAR TREINO
            </ButtonLink>
          }
        />
      ) : null}

      {!isLoading && data!.workouts.length > 0 ? (
        <section aria-label="Seus números" className="grid grid-cols-3 gap-4">
          <StatCard value={data!.workouts.length} label="treinos" />
          <StatCard value={Math.round(data!.totalSeconds / 60)} label="minutos" />
          <StatCard value={data!.streak.longest} label="maior sequência" />
        </section>
      ) : null}
    </div>
  );
}

function TodayCard({ day, goalSeconds }: { day: number; goalSeconds: number }) {
  return (
    <section
      aria-label="Treino de hoje"
      className="border-border bg-card flex flex-col items-center gap-6 rounded-2xl border p-6 shadow-sm"
    >
      <p className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">
        Treino de hoje
      </p>

      <ProgressRing value={0} size={216} strokeWidth={10}>
        <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">
          Dia {day}
        </span>
        <span className="tnum mt-1 text-5xl font-extrabold tracking-tight">
          {formatClock(goalSeconds)}
        </span>
      </ProgressRing>

      <div className="flex w-full flex-col items-center gap-3">
        <ButtonLink href="/treino/hoje?auto=1" className="h-16 w-full text-base font-bold">
          <Play aria-hidden className="size-5" />
          COMEÇAR TREINO
        </ButtonLink>

        {/* quem não sabe o que fazer hoje precisa de um caminho visível */}
        <Link
          href="/treinos"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm underline underline-offset-4"
        >
          <ListChecks aria-hidden className="size-3.5" />
          Escolher um treino pronto
        </Link>
      </div>
    </section>
  );
}

function DoneCard({ workouts, day }: { workouts: LocalWorkout[]; day: number }) {
  const total = workouts.reduce((sum, workout) => sum + workout.duration_seconds, 0);

  return (
    <section
      aria-label="Treino de hoje"
      className="border-success/30 bg-success/8 flex flex-col items-center gap-4 rounded-2xl border p-6 text-center"
    >
      <span className="bg-success/15 text-success flex size-14 items-center justify-center rounded-2xl">
        <Check aria-hidden className="size-7" />
      </span>

      <div>
        <p className="text-xl font-extrabold tracking-tight">Dia {day} está feito.</p>
        <p className="text-muted-foreground tnum mt-1 text-sm">
          {formatDurationShort(total)}
          {workouts.length > 1 ? ` em ${workouts.length} treinos` : ''}
        </p>
      </div>

      <ButtonLink href="/treino/hoje" variant="outline" className="h-11">
        Treinar de novo
      </ButtonLink>
    </section>
  );
}

function MonthStrip({ today, days }: { today: string; days: string[] }) {
  const trained = new Set(days);
  const cells = monthGrid(today);

  return (
    <section aria-label={`Calendário de ${monthLabel(today)}`} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-bold tracking-[0.18em] uppercase">{monthLabel(today)}</h2>
        <Link
          href="/calendario"
          className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-sm"
        >
          Ver tudo
          <ChevronRight aria-hidden className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label, index) => (
          <span
            key={`${label}-${index}`}
            aria-hidden
            className="text-muted-foreground text-center text-[11px] font-semibold"
          >
            {label}
          </span>
        ))}

        {cells.map(({ day, inMonth }) => {
          const isToday = day === today;
          const done = trained.has(day);
          const label = `${day.slice(8)} de ${WEEKDAY_NAMES[cells.findIndex((c) => c.day === day) % 7]}`;

          return (
            <span
              key={day}
              title={done ? `${label} — treinou` : label}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg text-xs font-medium',
                !inMonth && 'opacity-30',
                done && 'bg-primary text-primary-foreground',
                !done && isToday && 'border-primary text-primary border-2',
                !done && !isToday && 'bg-secondary text-muted-foreground',
              )}
            >
              {/* o dia treinado tem preenchimento e o de hoje tem contorno:
                  a diferença não depende só de cor */}
              {Number(day.slice(8))}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function LastWorkout({ workout, today }: { workout: LocalWorkout; today: string }) {
  return (
    <section aria-label="Último treino" className="flex flex-col gap-3">
      <h2 className="text-xs font-bold tracking-[0.18em] uppercase">Último treino</h2>

      <Link
        href={`/treino/${workout.client_id}`}
        className="border-border hover:bg-muted flex items-center gap-4 rounded-xl border p-4 transition-colors"
      >
        <div className="flex-1">
          <p className="font-semibold">{workout.title ?? workout.template_title ?? 'Treino livre'}</p>
          <p className="text-muted-foreground tnum mt-0.5 text-sm">
            {relativeDay(workout.workout_date, today)} · {formatDurationShort(workout.duration_seconds)}
            {workout.rounds ? ` · ${workout.rounds} rounds` : ''}
          </p>
        </div>
        <ChevronRight aria-hidden className="text-muted-foreground size-4" />
      </Link>
    </section>
  );
}
