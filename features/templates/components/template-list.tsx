'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Lightbulb, Play, Plus, Timer, Trophy } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/stats';
import { ButtonLink } from '@/components/ui/button-link';
import { Skeleton } from '@/components/ui/skeleton';
import { useExercises, useTemplates, type CatalogTemplate } from '@/features/exercises/catalog';
import { useToday } from '@/features/session/session-context';
import { useLocalWorkouts } from '@/features/workouts/use-workout';
import { cn } from '@/lib/utils';
import { formatDay } from '@/services/calendar';
import { formatDurationShort } from '@/services/duration';
import { suggestFocus, type RecentDay } from '@/services/suggestions';
import type { WorkoutLevel } from '@/types/database';

/**
 * Escolher um treino.
 *
 * Todos os treinos do P20X seguem o mesmo princípio: um circuito curto,
 * repetido no seu ritmo por 20 minutos, contando rounds. Isso deixa o cartão
 * previsível — sempre o mesmo formato — e transforma o número de rounds no
 * indicador de evolução. Cinco rounds no dia 1 e oito no dia 20 dizem mais que
 * qualquer estimativa de caloria.
 *
 * Dois filtros, como manda a decisão de produto: nível e objetivo. Equipamento
 * não é filtro, é informação — aparece em destaque em cada cartão, calculado a
 * partir dos exercícios que o treino usa.
 */

const NIVEIS: { value: WorkoutLevel | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Moderado' },
  { value: 'avancado', label: 'Avançado' },
];

const OBJETIVOS: { value: string | null; label: string }[] = [
  { value: null, label: 'Tudo' },
  { value: 'corpo_inteiro', label: 'Corpo inteiro' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'core', label: 'Core' },
  { value: 'superiores', label: 'Superiores' },
  { value: 'inferiores', label: 'Pernas' },
  { value: 'recuperacao_ativa', label: 'Recuperação' },
];

const NIVEL_LABEL: Record<WorkoutLevel, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Moderado',
  avancado: 'Avançado',
};

/** O melhor e o mais recente número de rounds de cada treino. */
type Marca = { recorde: number; ultimaRounds: number | null; ultimaData: string | null };

export function TemplateList({ onlyFavorites = false }: { onlyFavorites?: boolean }) {
  const today = useToday();
  const { data: templates, isLoading } = useTemplates();
  const { data: exercises } = useExercises();
  const { data: workouts } = useLocalWorkouts();

  const [nivel, setNivel] = useState<WorkoutLevel | 'todos'>('todos');
  const [objetivo, setObjetivo] = useState<string | null>(null);

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

  /** Histórico por treino: é ele que transforma o cartão num placar. */
  const marcas = useMemo(() => {
    const mapa = new Map<string, Marca>();

    for (const workout of workouts ?? []) {
      if (!workout.template_id || workout.rounds === null) continue;

      const atual = mapa.get(workout.template_id) ?? {
        recorde: 0,
        ultimaRounds: null,
        ultimaData: null,
      };

      atual.recorde = Math.max(atual.recorde, workout.rounds);
      // a lista já vem do mais recente para o mais antigo
      if (atual.ultimaData === null) {
        atual.ultimaRounds = workout.rounds;
        atual.ultimaData = workout.workout_date;
      }

      mapa.set(workout.template_id, atual);
    }

    return mapa;
  }, [workouts]);

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
      onlyFavorites ? !template.isSystem || template.isFavorite : true,
    );

    if (nivel !== 'todos') lista = lista.filter((template) => template.level === nivel);
    if (objetivo) lista = lista.filter((template) => template.tags.includes(objetivo));

    // quem já treinou aquilo vê primeiro; depois vale a progressão da biblioteca
    const nivelOrdem: Record<string, number> = { iniciante: 0, intermediario: 1, avancado: 2 };

    return [...lista].sort((a, b) => {
      const feitoA = marcas.has(a.id) ? 0 : 1;
      const feitoB = marcas.has(b.id) ? 0 : 1;
      if (feitoA !== feitoB) return feitoA - feitoB;

      const nivelA = nivelOrdem[a.level ?? ''] ?? 3;
      const nivelB = nivelOrdem[b.level ?? ''] ?? 3;
      if (nivelA !== nivelB) return nivelA - nivelB;

      return a.sortOrder - b.sortOrder;
    });
  }, [marcas, nivel, objetivo, onlyFavorites, templates]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 py-6">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-56 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-6">
      <PageHeader
        titulo={onlyFavorites ? 'Seus treinos' : 'Escolher um treino'}
        descricao="Todos funcionam igual: repita o circuito no seu ritmo durante 20 minutos e anote os rounds."
        trilha={onlyFavorites ? [{ href: '/treinos', label: 'Treinos' }] : []}
      />

      {suggestion && !onlyFavorites ? (
        <div className="border-border bg-secondary/60 flex gap-3 rounded-xl border p-4">
          <Lightbulb aria-hidden className="text-primary mt-0.5 size-5 shrink-0" />
          <p className="text-sm">{suggestion.message}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <Filtro label="Nível">
          {NIVEIS.map((opcao) => (
            <Chip key={opcao.value} active={nivel === opcao.value} onClick={() => setNivel(opcao.value)}>
              {opcao.label}
            </Chip>
          ))}
        </Filtro>

        <Filtro label="Objetivo">
          {OBJETIVOS.map((opcao) => (
            <Chip
              key={opcao.label}
              active={objetivo === opcao.value}
              onClick={() => setObjetivo(opcao.value)}
            >
              {opcao.label}
            </Chip>
          ))}
        </Filtro>
      </div>

      <ButtonLink href="/treinos/novo" variant="outline" className="h-12 justify-start">
        <Plus aria-hidden className="size-4" />
        Montar meu próprio treino
      </ButtonLink>

      {visiveis.length === 0 ? (
        <EmptyState
          icon={Timer}
          title={onlyFavorites ? 'Você ainda não montou um treino.' : 'Nada com esses filtros.'}
          description={
            onlyFavorites
              ? 'Monte o seu com os exercícios que você já faz — ele fica salvo para as próximas vezes.'
              : 'Tire um filtro ou comece um treino livre: o cronômetro não exige roteiro.'
          }
          action={
            <ButtonLink href={onlyFavorites ? '/treinos/novo' : '/treinar'} className="h-12">
              {onlyFavorites ? 'Montar um treino' : 'Treino livre'}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {visiveis.map((template) => (
            <li key={template.id}>
              <TemplateCard
                template={template}
                equipamento={equipamentoPorTemplate.get(template.id) ?? []}
                marca={marcas.get(template.id)}
                today={today}
              />
            </li>
          ))}
        </ul>
      )}

      {!onlyFavorites ? (
        <Link
          href="/treinar"
          className="text-muted-foreground hover:text-foreground self-center text-sm underline underline-offset-4"
        >
          Prefiro só o cronômetro, sem roteiro
        </Link>
      ) : null}
    </div>
  );
}

function TemplateCard({
  template,
  equipamento,
  marca,
  today,
}: {
  template: CatalogTemplate;
  equipamento: string[];
  marca: Marca | undefined;
  today: string;
}) {
  const semEquipamento = equipamento.length === 0;

  return (
    <article className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-extrabold tracking-tight">{template.title}</h2>
        {template.subtitle ? (
          <p className="text-muted-foreground text-sm">{template.subtitle}</p>
        ) : null}
      </header>

      {/* a ficha: o que é preciso saber antes de apertar iniciar */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Ficha termo="Nível" valor={template.level ? NIVEL_LABEL[template.level] : 'Livre'} />
        <Ficha termo="Duração" valor={formatDurationShort(template.estimatedSeconds)} />
        <Ficha
          termo="Equipamento"
          valor={semEquipamento ? 'Nenhum' : equipamento.join(', ')}
          destaque={semEquipamento}
        />
        <Ficha termo="Método" valor={template.method === 'amrap' ? 'AMRAP' : 'Livre'} />
      </dl>

      {template.exercises.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-[11px] font-bold tracking-[0.18em] uppercase">
            Round
          </p>
          <ul className="flex flex-col gap-1">
            {template.exercises.map((item) => (
              <li
                key={`${template.id}-${item.exerciseId}-${item.orderIndex}`}
                className="flex items-baseline gap-2"
              >
                <span className="tnum text-primary min-w-12 font-bold">
                  {item.repetitions !== null
                    ? `${item.repetitions} ×`
                    : item.durationSeconds !== null
                      ? `${item.durationSeconds}s`
                      : ''}
                </span>
                <span>{item.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {marca ? (
        <div className="border-border flex flex-wrap items-center gap-x-5 gap-y-1 border-t pt-3 text-sm">
          <span className="flex items-center gap-1.5">
            <Trophy aria-hidden className="text-primary size-3.5" />
            <span className="text-muted-foreground">Seu recorde:</span>
            <span className="tnum font-bold">{marca.recorde} rounds</span>
          </span>

          {marca.ultimaRounds !== null ? (
            <span className="text-muted-foreground">
              Última vez: <span className="tnum font-medium">{marca.ultimaRounds} rounds</span>
              {marca.ultimaData && marca.ultimaData !== today
                ? ` · ${formatDay(marca.ultimaData)}`
                : ''}
            </span>
          ) : null}
        </div>
      ) : null}

      <ButtonLink
        href={`/treinar?template=${template.id}`}
        className="h-14 text-base font-bold"
      >
        <Play aria-hidden className="size-4" />
        INICIAR {formatDurationShort(template.estimatedSeconds).replace(' min', ':00')}
      </ButtonLink>
    </article>
  );
}

function Ficha({ termo, valor, destaque }: { termo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {termo}
      </dt>
      <dd className={cn('font-medium', destaque && 'text-success')}>{valor}</dd>
    </div>
  );
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {label}
      </span>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
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
        'min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted',
      )}
    >
      {children}
    </button>
  );
}
