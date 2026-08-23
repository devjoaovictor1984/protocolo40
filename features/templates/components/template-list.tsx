'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Lightbulb, Play, Timer } from 'lucide-react';

import { EmptyState } from '@/components/stats';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { describeMetrics, useExercises, useTemplates } from '@/features/exercises/catalog';
import { useToday } from '@/features/session/session-context';
import { useLocalWorkouts } from '@/features/workouts/use-workout';
import { cn } from '@/lib/utils';
import { formatDurationShort } from '@/services/duration';
import { suggestFocus, type RecentDay } from '@/services/suggestions';
import type { WorkoutLevel } from '@/types/database';

/**
 * Sugestões de treino e templates salvos.
 *
 * Os treinos do sistema e os do usuário vivem na mesma tabela: a única
 * diferença é quem é o dono. Isso deixa "USAR HOJE" idêntico nos dois casos.
 */

const LEVEL_FILTERS: { value: WorkoutLevel | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
];

const TAG_FILTERS = [
  { value: 'sem_equipamento', label: 'Sem equipamento' },
  { value: 'academia', label: 'Academia' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'core', label: 'Core' },
  { value: 'superiores', label: 'Superiores' },
  { value: 'inferiores', label: 'Inferiores' },
  { value: 'corpo_inteiro', label: 'Corpo inteiro' },
  { value: 'recuperacao_ativa', label: 'Recuperação ativa' },
];

export function TemplateList({ onlyFavorites = false }: { onlyFavorites?: boolean }) {
  const today = useToday();
  const { data: templates, isLoading } = useTemplates();
  const { data: exercises } = useExercises();
  const { data: workouts } = useLocalWorkouts();

  const [level, setLevel] = useState<WorkoutLevel | 'todos'>('todos');
  const [tags, setTags] = useState<string[]>([]);

  // A sugestão precisa da categoria de cada exercício, que só o catálogo tem.
  const suggestion = useMemo(() => {
    if (!exercises || !workouts) return null;

    const categoryById = new Map(exercises.map((exercise) => [exercise.id, exercise.category]));
    const byDay = new Map<string, RecentDay>();

    for (const workout of workouts) {
      const entry = byDay.get(workout.workout_date) ?? { day: workout.workout_date, categories: [] };
      for (const item of workout.exercises) {
        const category = categoryById.get(item.exercise_id);
        if (category) entry.categories.push(category);
      }
      byDay.set(workout.workout_date, entry);
    }

    return suggestFocus([...byDay.values()], today);
  }, [exercises, today, workouts]);

  const visible = useMemo(() => {
    let list = (templates ?? []).filter((template) =>
      onlyFavorites ? template.isFavorite || !template.isSystem : true,
    );

    if (level !== 'todos') {
      list = list.filter((template) => template.level === level);
    }
    if (tags.length > 0) {
      list = list.filter((template) => tags.every((tag) => template.tags.includes(tag)));
    }

    return list;
  }, [level, onlyFavorites, tags, templates]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-6">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {onlyFavorites ? 'Seus treinos' : 'Treinos'}
        </h1>
        <p className="text-muted-foreground text-sm">
          Circuitos de mais ou menos 20 minutos. Escolha um e comece.
        </p>
      </header>

      {suggestion && !onlyFavorites ? (
        <div className="border-border bg-secondary/60 flex gap-3 rounded-xl border p-4">
          <Lightbulb aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm">{suggestion.message}</p>
            <button
              type="button"
              onClick={() => setTags(suggestion.tags.slice(0, 1))}
              className="text-primary text-sm font-medium underline underline-offset-4"
            >
              Ver esses treinos
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <FilterRow label="Nível">
          {LEVEL_FILTERS.map((filter) => (
            <FilterChip
              key={filter.value}
              active={level === filter.value}
              onClick={() => setLevel(filter.value)}
            >
              {filter.label}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Tipo">
          {TAG_FILTERS.map((filter) => (
            <FilterChip
              key={filter.value}
              active={tags.includes(filter.value)}
              onClick={() =>
                setTags((current) =>
                  current.includes(filter.value)
                    ? current.filter((tag) => tag !== filter.value)
                    : [...current, filter.value],
                )
              }
            >
              {filter.label}
            </FilterChip>
          ))}
        </FilterRow>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Timer}
          title="Nenhum treino com esses filtros."
          description="Tire um filtro ou comece um treino livre — o cronômetro não exige roteiro."
          action={
            <ButtonLink href="/treino/hoje?auto=1" className="h-12">
              Treino livre
            </ButtonLink>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((template) => (
            <li key={template.id}>
              <article className="border-border rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold tracking-tight">{template.title}</h2>
                    <p className="text-muted-foreground tnum mt-0.5 text-xs">
                      {formatDurationShort(template.estimatedSeconds)}
                      {template.level ? ` · ${labelOfLevel(template.level)}` : ''}
                      {template.isSystem ? '' : ' · seu'}
                    </p>
                  </div>

                  <Button
                    render={<Link href={`/treino/hoje?template=${template.id}&auto=1`} />}
                    size="sm"
                    className="h-10 shrink-0 px-4 font-semibold"
                  >
                    <Play aria-hidden className="size-3.5" />
                    USAR HOJE
                  </Button>
                </div>

                {template.description ? (
                  <p className="text-muted-foreground mt-2 text-sm">{template.description}</p>
                ) : null}

                {template.exercises.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1">
                    {template.exercises.map((item) => (
                      <li
                        key={`${template.id}-${item.exerciseId}-${item.orderIndex}`}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <span>{item.name}</span>
                        <span className="text-muted-foreground tnum">{describeMetrics(item)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function labelOfLevel(level: WorkoutLevel): string {
  return level === 'iniciante' ? 'Iniciante' : level === 'intermediario' ? 'Intermediário' : 'Avançado';
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {label}
      </span>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
