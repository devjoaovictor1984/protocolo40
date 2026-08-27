'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  Camera,
  ChevronRight,
  Clock,
  Flame,
  HeartPulse,
  LineChart as LineChartIcon,
  Scale,
  Stethoscope,
  Trophy,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { BarChart, LineChart } from '@/components/charts';
import { EmptyState, StatCard } from '@/components/stats';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useExercises } from '@/features/exercises/catalog';
import { useRestDays } from '@/features/rest/use-rest-days';
import { localMeasurements } from '@/features/measurements/repository';
import { useSession, useToday } from '@/features/session/session-context';
import { useLocalWorkouts } from '@/features/workouts/use-workout';
import { cn } from '@/lib/utils';
import { calculateStreak } from '@/services/streak';
import {
  exerciseVolume,
  exercisesUsed,
  weeklyMinutes,
  weeklyWorkoutDays,
  weightDelta,
  weightSeries,
} from '@/services/progress';

/**
 * Evolução.
 *
 * Poucas métricas, escolhidas para responder "estou melhorando?": peso,
 * frequência, minutos e volume. Nada de painel corporativo.
 */
export function ProgressOverview() {
  const { userId } = useSession();
  const today = useToday();
  const { data: workouts, isLoading } = useLocalWorkouts();
  const { data: exercises } = useExercises();
  const { data: descansos } = useRestDays();

  const { data: measurements } = useQuery({
    queryKey: ['measurements', userId],
    queryFn: () => localMeasurements(userId),
    staleTime: 10_000,
  });

  const [exerciseId, setExerciseId] = useState<string | null>(null);

  const used = useMemo(() => exercisesUsed(workouts ?? []).slice(0, 8), [workouts]);
  const selectedExercise = exerciseId ?? used[0]?.exerciseId ?? null;
  const nameById = useMemo(
    () => new Map((exercises ?? []).map((exercise) => [exercise.id, exercise.name])),
    [exercises],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  const all = workouts ?? [];

  if (all.length === 0) {
    return (
      <div className="py-6">
        <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Evolução</h1>
        <EmptyState
          icon={LineChartIcon}
          title="Sua evolução aparece a partir do primeiro treino."
          description="Depois de alguns dias os gráficos começam a contar a história sozinhos."
          action={
            <ButtonLink href="/treinar" className="h-12">
              COMEÇAR TREINO
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const days = [...new Set(all.map((workout) => workout.workout_date))];
  // mesma razão do painel: o descanso segura a corrente
  const streak = calculateStreak(days, today, descansos ?? []);
  const totalMinutes = Math.round(
    all.reduce((sum, workout) => sum + workout.duration_seconds, 0) / 60,
  );
  const weights = weightSeries(measurements ?? []);
  const delta = weightDelta(measurements ?? []);
  const volume = selectedExercise
    ? exerciseVolume(all, selectedExercise, today)
    : { series: [], unit: 'repetições' };

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Evolução</h1>
        <ButtonLink href="/evolucao/fotos" variant="outline" size="sm" className="h-10">
          <Camera aria-hidden className="size-4" />
          Fotos
        </ButtonLink>
      </header>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={days.length} unit="dias" label="Treinados" icon={CalendarCheck} />
        <StatCard value={totalMinutes} unit="min" label="Tempo" icon={Clock} />
        <StatCard value={streak.current} unit="dias" label="Sequência" icon={Flame} />
        <StatCard value={streak.longest} unit="dias" label="Recorde" icon={Trophy} />
      </section>

      <LineChart
        title="Peso"
        unit="kg"
        data={weights}
        format={(value) => value.toFixed(1).replace('.', ',')}
        emptyMessage="Registre seu peso em Medidas para ver a curva aqui."
      />

      {delta !== null ? (
        <p className="text-muted-foreground -mt-3 text-sm">
          {delta === 0
            ? 'Mesmo peso do primeiro registro.'
            : `${delta < 0 ? '−' : '+'}${Math.abs(delta).toFixed(1).replace('.', ',')} kg desde o primeiro registro.`}
        </p>
      ) : null}

      <BarChart
        title="Dias treinados por semana"
        unit="dias"
        data={weeklyWorkoutDays(all, today)}
        emptyMessage="Sem treinos nas últimas semanas."
      />

      <BarChart
        title="Minutos por semana"
        unit="min"
        data={weeklyMinutes(all, today)}
        emptyMessage="Sem treinos nas últimas semanas."
      />

      {used.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Exercício">
            {used.map(({ exerciseId: id }) => (
              <button
                key={id}
                type="button"
                aria-pressed={selectedExercise === id}
                onClick={() => setExerciseId(id)}
                className={cn(
                  'min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
                  selectedExercise === id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-muted',
                )}
              >
                {nameById.get(id) ?? 'Exercício'}
              </button>
            ))}
          </div>

          <BarChart
            title={`Volume de ${nameById.get(selectedExercise ?? '') ?? 'exercício'}`}
            unit={volume.unit}
            data={volume.series}
            emptyMessage="Sem volume registrado para este exercício."
          />
        </section>
      ) : null}

      {/* A consultoria vem primeiro: é o que responde "e agora?" */}
      <Link
        href="/analise"
        className="border-primary/40 bg-primary/5 hover:bg-primary/10 flex items-center gap-4 rounded-xl border p-4 transition-colors"
      >
        <Stethoscope aria-hidden className="text-primary size-5" />
        <span className="flex-1">
          <span className="block font-semibold">Análise do seu treino</span>
          <span className="text-muted-foreground text-sm">
            O que mudar em cada exercício, e por quê
          </span>
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-4" />
      </Link>

      <Link
        href="/saude"
        className="border-border hover:bg-muted flex items-center gap-4 rounded-xl border p-4 transition-colors"
      >
        <HeartPulse aria-hidden className="text-primary size-5" />
        <span className="flex-1">
          <span className="block font-semibold">Saúde e metas do dia</span>
          <span className="text-muted-foreground text-sm">
            Água, calorias, proteína e faixa de peso
          </span>
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-4" />
      </Link>

      <Link
        href="/medidas"
        className="border-border hover:bg-muted flex items-center gap-4 rounded-xl border p-4 transition-colors"
      >
        <Scale aria-hidden className="text-primary size-5" />
        <span className="flex-1">
          <span className="block font-semibold">Peso e medidas</span>
          <span className="text-muted-foreground text-sm">Registrar e ver o histórico</span>
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-4" />
      </Link>

      <Link
        href="/evolucao/comparar"
        className="border-border hover:bg-muted flex items-center gap-4 rounded-xl border p-4 transition-colors"
      >
        <Camera aria-hidden className="text-primary size-5" />
        <span className="flex-1">
          <span className="block font-semibold">Comparar fotos</span>
          <span className="text-muted-foreground text-sm">Lado a lado ou com o slider</span>
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-4" />
      </Link>
    </div>
  );
}
