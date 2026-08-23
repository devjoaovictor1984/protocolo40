'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, CloudOff, History, Search } from 'lucide-react';

import { EmptyState } from '@/components/stats';
import { ButtonLink } from '@/components/ui/button-link';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToday } from '@/features/session/session-context';
import { useLocalWorkouts } from '@/features/workouts/use-workout';
import { cn } from '@/lib/utils';
import { addDays, formatDay, monthLabel, monthKey } from '@/services/calendar';
import { formatDurationShort } from '@/services/duration';
import type { LocalWorkout } from '@/types/offline';

/**
 * Histórico.
 *
 * Buscar por "Tom Holland" e ver os dias em que aquele circuito foi feito, com
 * quantos rounds, é o caso de uso principal desta tela.
 */

const PERIODS = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
  { value: 0, label: 'Tudo' },
];

export function HistoryList() {
  const today = useToday();
  const { data: workouts, isLoading } = useLocalWorkouts();
  const [term, setTerm] = useState('');
  const [period, setPeriod] = useState(30);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    const from = period > 0 ? addDays(today, -period) : '0000-01-01';

    return (workouts ?? []).filter((workout) => {
      if (workout.workout_date < from) return false;
      if (!needle) return true;

      const haystack = [
        workout.title,
        workout.template_title,
        workout.notes,
        ...workout.exercises.map((item) => item.exercise_name),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [period, term, today, workouts]);

  const groups = useMemo(() => {
    const map = new Map<string, LocalWorkout[]>();
    for (const workout of filtered) {
      const key = monthKey(workout.workout_date);
      map.set(key, [...(map.get(key) ?? []), workout]);
    }
    return [...map.entries()];
  }, [filtered]);

  const totalSeconds = filtered.reduce((sum, workout) => sum + workout.duration_seconds, 0);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-6">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">Histórico</h1>
          <ButtonLink href="/calendario" variant="outline" size="sm" className="h-10">
            <CalendarDays aria-hidden className="size-4" />
            Calendário
          </ButtonLink>
        </div>

        <div className="relative">
          <Search aria-hidden className="text-muted-foreground absolute top-3.5 left-3 size-4" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar treino ou exercício"
            aria-label="Buscar treino ou exercício"
            className="h-12 pl-9"
          />
        </div>

        <div className="flex gap-2" role="group" aria-label="Período">
          {PERIODS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
              className={cn(
                'min-h-9 flex-1 rounded-full border text-sm font-medium transition-colors',
                period === option.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title={term ? 'Nada encontrado com esse termo.' : 'Seu histórico começa no primeiro treino.'}
          description={
            term
              ? 'Tente outro nome de treino ou de exercício.'
              : 'Cada treino registrado aparece aqui, com duração, rounds e exercícios.'
          }
          action={
            term ? null : (
              <ButtonLink href="/treino/hoje?auto=1" className="h-12">
                COMEÇAR TREINO
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <p className="text-muted-foreground tnum text-sm">
            {filtered.length} {filtered.length === 1 ? 'treino' : 'treinos'} ·{' '}
            {formatDurationShort(totalSeconds)}
          </p>

          <div className="flex flex-col gap-6">
            {groups.map(([month, items]) => (
              <section key={month} className="flex flex-col gap-2">
                <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  {monthLabel(`${month}-01`)}
                </h2>

                <ul className="flex flex-col gap-2">
                  {items.map((workout) => (
                    <li key={workout.client_id}>
                      <WorkoutRow workout={workout} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function WorkoutRow({ workout }: { workout: LocalWorkout }) {
  const pending = workout.sync_state !== 'synced';

  return (
    <Link
      href={`/treino/${workout.client_id}`}
      className="border-border hover:bg-muted flex items-center gap-4 rounded-xl border p-4 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">
            {workout.title ?? workout.template_title ?? 'Treino livre'}
          </p>
          {pending ? (
            <span
              title="Ainda não sincronizado"
              className="text-muted-foreground inline-flex items-center gap-1 text-[11px]"
            >
              <CloudOff aria-hidden className="size-3" />
              pendente
            </span>
          ) : null}
        </div>

        <p className="text-muted-foreground tnum mt-0.5 text-sm">
          {formatDay(workout.workout_date)} · {formatDurationShort(workout.duration_seconds)}
          {workout.rounds ? ` · ${workout.rounds} rounds` : ''}
        </p>

        {workout.exercises.length > 0 ? (
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {workout.exercises.map((item) => item.exercise_name).join(' · ')}
          </p>
        ) : null}
      </div>

      <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}
