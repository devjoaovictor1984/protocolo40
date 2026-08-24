'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useToday } from '@/features/session/session-context';
import { useLocalWorkouts } from '@/features/workouts/use-workout';
import { cn } from '@/lib/utils';
import {
  addDays,
  formatDay,
  monthGrid,
  monthKey,
  monthLabel,
  startOfMonth,
  WEEKDAY_LABELS,
} from '@/services/calendar';
import { formatDurationShort } from '@/services/duration';

/**
 * Calendário mensal.
 *
 * Dia treinado, hoje e dia vazio se distinguem por preenchimento, contorno e
 * ponto — nunca só pela cor. Tocar num dia abre o que aconteceu nele.
 */
export function MonthCalendar({ comLista = false }: { comLista?: boolean }) {
  const today = useToday();
  const { data: workouts, isLoading } = useLocalWorkouts();
  const [reference, setReference] = useState(() => startOfMonth(today));
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, typeof workouts>();
    for (const workout of workouts ?? []) {
      map.set(workout.workout_date, [...(map.get(workout.workout_date) ?? []), workout]);
    }
    return map;
  }, [workouts]);

  const cells = monthGrid(reference);
  const monthWorkouts = (workouts ?? []).filter(
    (workout) => monthKey(workout.workout_date) === monthKey(reference),
  );
  const monthSeconds = monthWorkouts.reduce((sum, workout) => sum + workout.duration_seconds, 0);
  const selectedWorkouts = selected ? (byDay.get(selected) ?? []) : [];

  if (isLoading) {
    return <Skeleton className="mt-6 h-96 w-full rounded-2xl" />;
  }

  return (
    <div className={cn('flex flex-col gap-6', comLista ? 'pt-6' : 'py-6')}>
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">Calendário</h1>
          {/* com a lista logo abaixo, o atalho para ela seria ruído */}
          {comLista ? null : (
            <ButtonLink href="/calendario" variant="ghost" size="sm" className="h-9">
              <List aria-hidden className="size-4" />
              Lista
            </ButtonLink>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setReference((current) => startOfMonth(addDays(current, -1)))}
            aria-label="Mês anterior"
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setReference((current) => startOfMonth(addDays(current, 32)))
            }
            aria-label="Próximo mês"
            disabled={monthKey(reference) >= monthKey(today)}
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold capitalize">{monthLabel(reference)}</h2>
          <p className="text-muted-foreground tnum text-sm">
            {monthWorkouts.length} {monthWorkouts.length === 1 ? 'treino' : 'treinos'} ·{' '}
            {formatDurationShort(monthSeconds)}
          </p>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((label, index) => (
            <span
              key={`${label}-${index}`}
              aria-hidden
              className="text-muted-foreground pb-1 text-center text-[11px] font-semibold"
            >
              {label}
            </span>
          ))}

          {cells.map(({ day, inMonth }) => {
            const trained = byDay.has(day);
            const isToday = day === today;
            const future = day > today;

            return (
              <button
                key={day}
                type="button"
                disabled={!trained && !isToday}
                onClick={() => setSelected(day)}
                aria-label={`${formatDay(day)}${trained ? ' — treinou' : isToday ? ' — hoje' : ' — sem treino'}`}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors',
                  !inMonth && 'opacity-25',
                  future && 'opacity-30',
                  trained && 'bg-primary text-primary-foreground',
                  !trained && isToday && 'border-primary border-2',
                  !trained && !isToday && 'bg-secondary text-muted-foreground',
                  (trained || isToday) && 'hover:opacity-90',
                )}
              >
                <span className="tnum">{Number(day.slice(8))}</span>
                {trained ? (
                  <span aria-hidden className="bg-primary-foreground mt-0.5 size-1 rounded-full" />
                ) : null}
              </button>
            );
          })}
        </div>

        <ul className="text-muted-foreground flex flex-wrap gap-4 text-xs">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="bg-primary size-3 rounded" /> treinou
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="border-primary size-3 rounded border-2" /> hoje
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="bg-secondary size-3 rounded" /> sem treino
          </li>
        </ul>
      </section>

      <Drawer open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{selected ? formatDay(selected) : ''}</DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col gap-3 px-4 pb-8">
            {selectedWorkouts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CalendarDays aria-hidden className="text-muted-foreground size-6" />
                <p className="text-muted-foreground text-sm">
                  {selected === today
                    ? 'Ainda sem treino hoje. Vinte minutos e o dia fica marcado.'
                    : 'Nenhum treino neste dia.'}
                </p>
                {selected === today ? (
                  <ButtonLink href="/treinar" className="h-12">
                    COMEÇAR TREINO
                  </ButtonLink>
                ) : null}
              </div>
            ) : (
              selectedWorkouts.map((workout) => (
                <Link
                  key={workout.client_id}
                  href={`/treino/${workout.client_id}`}
                  className="border-border hover:bg-muted rounded-xl border p-4 transition-colors"
                >
                  <p className="font-semibold">
                    {workout.title ?? workout.template_title ?? 'Treino livre'}
                  </p>
                  <p className="text-muted-foreground tnum mt-0.5 text-sm">
                    {formatDurationShort(workout.duration_seconds)}
                    {workout.rounds ? ` · ${workout.rounds} rounds` : ''}
                  </p>
                  {workout.exercises.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-0.5 text-sm">
                      {workout.exercises.map((item, index) => (
                        <li key={`${item.exercise_id}-${index}`} className="text-muted-foreground">
                          {item.exercise_name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </Link>
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
