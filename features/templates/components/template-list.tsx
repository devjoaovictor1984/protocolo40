'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Lightbulb, Play, Timer } from 'lucide-react';

import { EmptyState } from '@/components/stats';
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
 * Escolher um treino.
 *
 * A pergunta que a tela responde é "o que eu consigo fazer agora, com o que eu
 * tenho". Por isso o primeiro corte é equipamento, e não grupo muscular — e o
 * padrão é o caso mais comum: nada, em casa.
 *
 * Foco e nível continuam existindo, mas fechados. Doze filtros abertos de uma
 * vez transformavam uma escolha simples numa consulta.
 */

type Equipamento = 'nenhum' | 'academia' | 'todos';

const EQUIPAMENTO: { value: Equipamento; label: string }[] = [
  { value: 'nenhum', label: 'Sem equipamento' },
  { value: 'academia', label: 'Com equipamento' },
  { value: 'todos', label: 'Todos' },
];

const FOCOS = [
  { value: 'corpo_inteiro', label: 'Corpo inteiro' },
  { value: 'superiores', label: 'Superiores' },
  { value: 'inferiores', label: 'Pernas' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'recuperacao_ativa', label: 'Leve' },
];

const NIVEIS: { value: WorkoutLevel | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Qualquer nível' },
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
];

export function TemplateList({ onlyFavorites = false }: { onlyFavorites?: boolean }) {
  const today = useToday();
  const { data: templates, isLoading } = useTemplates();
  const { data: exercises } = useExercises();
  const { data: workouts } = useLocalWorkouts();

  const [equipamento, setEquipamento] = useState<Equipamento>('nenhum');
  const [foco, setFoco] = useState<string | null>(null);
  const [nivel, setNivel] = useState<WorkoutLevel | 'todos'>('todos');
  const [maisFiltros, setMaisFiltros] = useState(false);

  /** O que cada treino exige, somado a partir dos exercícios que ele usa. */
  const equipamentoPorTemplate = useMemo(() => {
    const porExercicio = new Map((exercises ?? []).map((item) => [item.id, item.equipment]));
    const mapa = new Map<string, string[]>();

    for (const template of templates ?? []) {
      const itens = new Set<string>();
      for (const exercicio of template.exercises) {
        for (const item of porExercicio.get(exercicio.exerciseId) ?? []) itens.add(item);
      }
      mapa.set(template.id, [...itens]);
    }

    return mapa;
  }, [exercises, templates]);

  const suggestion = useMemo(() => {
    if (!exercises || !workouts) return null;

    const categoriaPorId = new Map(exercises.map((item) => [item.id, item.category]));
    const porDia = new Map<string, RecentDay>();

    for (const workout of workouts) {
      const entrada = porDia.get(workout.workout_date) ?? {
        day: workout.workout_date,
        categories: [],
      };
      for (const item of workout.exercises) {
        const categoria = categoriaPorId.get(item.exercise_id);
        if (categoria) entrada.categories.push(categoria);
      }
      porDia.set(workout.workout_date, entrada);
    }

    return suggestFocus([...porDia.values()], today);
  }, [exercises, today, workouts]);

  const visiveis = useMemo(() => {
    let lista = (templates ?? []).filter((template) =>
      onlyFavorites ? template.isFavorite || !template.isSystem : true,
    );

    if (equipamento !== 'todos') {
      lista = lista.filter((template) => {
        const precisa = (equipamentoPorTemplate.get(template.id) ?? []).length > 0;
        return equipamento === 'nenhum' ? !precisa : precisa;
      });
    }
    if (foco) {
      lista = lista.filter((template) => template.tags.includes(foco));
    }
    if (nivel !== 'todos') {
      lista = lista.filter((template) => template.level === nivel);
    }

    return lista;
  }, [equipamento, equipamentoPorTemplate, foco, nivel, onlyFavorites, templates]);

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
    <div className="flex flex-col gap-5 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {onlyFavorites ? 'Seus treinos' : 'Escolher um treino'}
        </h1>
        <p className="text-muted-foreground text-sm">
          Cerca de 20 minutos cada. Toque em USAR HOJE e o cronômetro já começa.
        </p>
      </header>

      {suggestion && !onlyFavorites ? (
        <div className="border-border bg-secondary/60 flex gap-3 rounded-xl border p-4">
          <Lightbulb aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
          <p className="text-sm">{suggestion.message}</p>
        </div>
      ) : null}

      {/* o primeiro corte é o que você tem em mãos */}
      <div className="border-border flex rounded-xl border p-1" role="group" aria-label="Equipamento">
        {EQUIPAMENTO.map((opcao) => (
          <button
            key={opcao.value}
            type="button"
            aria-pressed={equipamento === opcao.value}
            onClick={() => setEquipamento(opcao.value)}
            className={cn(
              'min-h-11 flex-1 rounded-lg px-2 text-sm font-medium transition-colors',
              equipamento === opcao.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {opcao.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setMaisFiltros((valor) => !valor)}
          aria-expanded={maisFiltros}
          className="text-muted-foreground hover:text-foreground flex min-h-10 items-center gap-1 self-start text-sm"
        >
          Filtrar por foco e nível
          <ChevronDown
            aria-hidden
            className={cn('size-4 transition-transform', maisFiltros && 'rotate-180')}
          />
        </button>

        {maisFiltros ? (
          <div className="flex flex-col gap-3">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Foco">
              {FOCOS.map((opcao) => (
                <Chip
                  key={opcao.value}
                  active={foco === opcao.value}
                  onClick={() => setFoco(foco === opcao.value ? null : opcao.value)}
                >
                  {opcao.label}
                </Chip>
              ))}
            </div>

            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Nível">
              {NIVEIS.map((opcao) => (
                <Chip
                  key={opcao.value}
                  active={nivel === opcao.value}
                  onClick={() => setNivel(opcao.value)}
                >
                  {opcao.label}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {visiveis.length === 0 ? (
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
          {visiveis.map((template) => {
            const precisa = equipamentoPorTemplate.get(template.id) ?? [];

            return (
              <li key={template.id}>
                <article className="border-border rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-bold tracking-tight">{template.title}</h2>
                      <p className="text-muted-foreground tnum mt-0.5 text-xs">
                        {formatDurationShort(template.estimatedSeconds)}
                        {template.level ? ` · ${rotuloNivel(template.level)}` : ''}
                        {template.isSystem ? '' : ' · seu'}
                      </p>
                    </div>

                    <ButtonLink
                      href={`/treino/hoje?template=${template.id}&auto=1`}
                      size="sm"
                      className="h-10 shrink-0 px-4 font-semibold"
                    >
                      <Play aria-hidden className="size-3.5" />
                      USAR HOJE
                    </ButtonLink>
                  </div>

                  {/* saber o que precisa antes de abrir o cronômetro */}
                  <p
                    className={cn(
                      'mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
                      precisa.length === 0
                        ? 'bg-success/12 text-success'
                        : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {precisa.length === 0 ? 'Sem equipamento' : `Precisa de ${precisa.join(', ')}`}
                  </p>

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
            );
          })}
        </ul>
      )}

      {!onlyFavorites ? (
        <Link
          href="/treino/hoje?auto=1"
          className="text-muted-foreground hover:text-foreground self-center text-sm underline underline-offset-4"
        >
          Prefiro só o cronômetro, sem roteiro
        </Link>
      ) : null}
    </div>
  );
}

function rotuloNivel(level: WorkoutLevel): string {
  return level === 'iniciante'
    ? 'Iniciante'
    : level === 'intermediario'
      ? 'Intermediário'
      : 'Avançado';
}

function Chip({
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
