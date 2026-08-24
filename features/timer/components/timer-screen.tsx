'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Minus, Pause, Play, Plus, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

import { ProgressRing } from '@/components/progress-ring';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeMetrics, useTemplate } from '@/features/exercises/catalog';
import { useSession } from '@/features/session/session-context';
import { useTimer } from '@/features/timer/use-timer';
import { saveWorkout } from '@/features/workouts/repository';
import { useOnlineStatus } from '@/lib/offline/network';
import { cn } from '@/lib/utils';
import { formatClock, MIN_MEANINGFUL_SECONDS } from '@/services/duration';
import type { LocalWorkoutExercise } from '@/types/offline';

/**
 * Tela do cronômetro.
 *
 * Uma coisa só acontece aqui: treinar. Os controles ficam na metade de baixo,
 * grandes e separados, porque a mão que os usa está suada e ocupada.
 */
export function TimerScreen({
  templateId,
  autoStart,
}: {
  templateId: string | null;
  autoStart: boolean;
}) {
  const router = useRouter();
  const { userId } = useSession();
  const online = useOnlineStatus();
  const timer = useTimer();
  const { data: template } = useTemplate(templateId ?? timer.session?.templateId ?? null);

  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  // Vindo do dashboard, o treino já começa correndo: um toque, não dois.
  useEffect(() => {
    if (timer.loading || timer.running || !autoStart || started.current) return;
    started.current = true;
    void timer.start({
      templateId: template?.id ?? templateId ?? null,
      templateTitle: template?.title ?? null,
      targetSeconds: template?.estimatedSeconds,
    });
  }, [autoStart, template, templateId, timer]);

  if (timer.loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
        <Skeleton className="size-64 rounded-full" />
        <Skeleton className="h-14 w-64 rounded-xl" />
      </div>
    );
  }

  if (!timer.running) {
    return <ReadyScreen timer={timer} template={template} templateId={templateId} />;
  }

  const session = timer.session!;

  async function handleFinish() {
    // Um treino de poucos segundos quase sempre é toque errado. Perguntar aqui
    // evita um registro sem sentido no histórico e na sequência.
    if (timer.elapsed < MIN_MEANINGFUL_SECONDS) {
      const confirmado = window.confirm(
        `O cronômetro rodou ${timer.elapsed} ${timer.elapsed === 1 ? 'segundo' : 'segundos'}. ` +
          'Registrar assim mesmo?',
      );
      if (!confirmado) return;
    }

    setSaving(true);

    try {
      const result = await timer.finish();
      if (!result) return;

      const exercises: LocalWorkoutExercise[] = (template?.exercises ?? []).map((item, index) => ({
        exercise_id: item.exerciseId,
        exercise_name: item.name,
        // com rounds, o volume do treino é o do circuito multiplicado
        sets: result.rounds > 0 ? result.rounds : item.sets,
        repetitions: item.repetitions,
        duration_seconds: item.durationSeconds,
        distance_meters: item.distanceMeters,
        weight_kg: item.weightKg,
        order_index: index,
        notes: null,
      }));

      await saveWorkout({
        clientId: result.clientId,
        userId,
        templateId: result.templateId,
        templateTitle: template?.title ?? null,
        title: result.title,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        durationSeconds: result.durationSeconds,
        workoutDate: result.workoutDate,
        rounds: result.rounds > 0 ? result.rounds : null,
        effort: null,
        location: null,
        notes: null,
        exercises,
      });

      router.replace(`/treino/${result.clientId}/finalizar`);
    } catch {
      setSaving(false);
      toast.error('Não foi possível encerrar o treino.', {
        description: 'Tente novamente — seu tempo continua contando.',
      });
    }
  }

  async function handleDiscard() {
    if (timer.elapsed > 60) {
      const confirmed = window.confirm(
        'Sair agora descarta este treino. Você já está há mais de um minuto treinando.',
      );
      if (!confirmed) return;
    }
    await timer.discard();
    router.replace('/hoje');
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-4">
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={() => void handleDiscard()}
          aria-label="Sair sem salvar"
        >
          <X aria-hidden className="size-5" />
        </Button>

        <p className="truncate text-sm font-semibold">{template?.title ?? 'Treino livre'}</p>

        <Button
          variant="ghost"
          size="icon-lg"
          onClick={timer.toggleMode}
          aria-label={
            timer.mode === 'regressivo'
              ? 'Mudar para cronômetro crescente'
              : 'Mudar para cronômetro regressivo'
          }
        >
          <RefreshCw aria-hidden className="size-4.5" />
        </Button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <ProgressRing
          value={timer.ratio}
          size={272}
          strokeWidth={12}
          label={`${formatClock(timer.display)} ${timer.mode === 'regressivo' ? 'restantes' : 'decorridos'}`}
          indicatorClassName={cn(timer.paused && 'stroke-muted-foreground')}
        >
          <span
            className={cn(
              'tnum text-6xl font-extrabold tracking-tight tabular-nums',
              timer.paused && 'text-muted-foreground',
            )}
          >
            {formatClock(timer.display)}
          </span>
          <span className="text-muted-foreground mt-2 text-xs font-medium tracking-wide uppercase">
            {timer.paused ? 'Pausado' : timer.mode === 'regressivo' ? 'Restantes' : 'Decorridos'}
          </span>
        </ProgressRing>

        {template && template.exercises.length > 0 ? (
          <ul className="w-full max-w-sm space-y-1">
            {template.exercises.map((item) => {
              const checked = session.checked.includes(item.exerciseId);
              return (
                <li key={item.exerciseId}>
                  <button
                    type="button"
                    onClick={() => timer.toggleChecked(item.exerciseId)}
                    aria-pressed={checked}
                    className={cn(
                      'flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 text-left transition-colors',
                      checked
                        ? 'border-success/40 bg-success/8 text-muted-foreground'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-md border',
                        checked ? 'border-success bg-success text-success-foreground' : 'border-border',
                      )}
                    >
                      {checked ? <Check className="size-3.5" /> : null}
                    </span>
                    <span className={cn('flex-1 font-medium', checked && 'line-through')}>
                      {item.name}
                    </span>
                    <span className="text-muted-foreground tnum text-sm">
                      {describeMetrics(item)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="flex items-center gap-4">
          <span className="text-muted-foreground text-sm font-medium">Rounds</span>
          <div className="border-border flex items-center gap-1 rounded-xl border p-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={() => timer.setRounds(timer.rounds - 1)}
              disabled={timer.rounds === 0}
              aria-label="Remover um round"
            >
              <Minus aria-hidden className="size-4" />
            </Button>
            <span className="tnum w-10 text-center text-lg font-bold">{timer.rounds}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-10"
              onClick={() => timer.setRounds(timer.rounds + 1)}
              aria-label="Adicionar um round"
            >
              <Plus aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <footer className="pb-safe flex flex-col items-center gap-3 px-6 pt-4">
        <div className="flex w-full max-w-sm gap-4">
          <Button
            variant="secondary"
            className="h-14 flex-1 text-base font-semibold"
            onClick={timer.paused ? timer.resume : timer.pause}
          >
            {timer.paused ? (
              <>
                <Play aria-hidden className="size-4" />
                Continuar
              </>
            ) : (
              <>
                <Pause aria-hidden className="size-4" />
                Pausar
              </>
            )}
          </Button>

          <Button
            className="h-14 flex-1 text-base font-semibold"
            onClick={() => void handleFinish()}
            disabled={saving}
          >
            {saving ? 'Salvando…' : 'Finalizar'}
          </Button>
        </div>

        <Button variant="ghost" size="sm" className="h-10" onClick={() => timer.addMinutes(5)}>
          + 5 minutos
        </Button>

        <p className="text-muted-foreground pb-4 text-xs">
          {online ? 'Seu treino é salvo no aparelho antes de subir.' : 'Offline — salvo no aparelho.'}
        </p>
      </footer>
    </div>
  );
}

function ReadyScreen({
  timer,
  template,
  templateId,
}: {
  timer: ReturnType<typeof useTimer>;
  template: ReturnType<typeof useTemplate>['data'];
  templateId: string | null;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-4">
        <Button variant="ghost" size="icon-lg" onClick={() => router.back()} aria-label="Voltar">
          <X aria-hidden className="size-5" />
        </Button>
        <p className="truncate text-sm font-semibold">{template?.title ?? 'Treino livre'}</p>
        <span className="size-9" />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <ProgressRing value={0} size={272} strokeWidth={12}>
          <span className="tnum text-6xl font-extrabold tracking-tight">
            {formatClock(template?.estimatedSeconds ?? 1200)}
          </span>
          <span className="text-muted-foreground mt-2 text-xs font-medium tracking-wide uppercase">
            Sua meta de hoje
          </span>
        </ProgressRing>

        {template?.description ? (
          <p className="text-muted-foreground max-w-xs text-sm text-balance">{template.description}</p>
        ) : null}

        {/*
         * O que vai ser feito, antes de começar.
         *
         * Abrir o cronômetro já correndo economizava um toque e custava a
         * informação que importa: quantos exercícios são, quais, e quantas
         * repetições. Quem não sabe o que vem pela frente para no meio.
         */}
        {template && template.exercises.length > 0 ? (
          <ul className="border-border w-full max-w-sm divide-y rounded-2xl border text-left">
            {template.exercises.map((item, index) => (
              <li
                key={`${item.exerciseId}-${index}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="truncate text-sm font-medium">{item.name}</span>
                <span className="text-muted-foreground tnum shrink-0 text-sm">
                  {describeMetrics(item)}
                </span>
              </li>
            ))}
          </ul>
        ) : templateId || timer.session?.templateId ? null : (
          <p className="text-muted-foreground max-w-xs text-sm text-balance">
            Treino livre: você decide o que fazer. Se quiser um pronto, escolha em Treinos.
          </p>
        )}
      </div>

      <footer className="pb-safe flex flex-col items-center gap-3 px-6 pb-8">
        <Button
          className="h-16 w-full max-w-sm text-base font-bold"
          onClick={() =>
            void timer.start({
              templateId: template?.id ?? templateId ?? null,
              templateTitle: template?.title ?? null,
              targetSeconds: template?.estimatedSeconds,
            })
          }
        >
          <Play aria-hidden className="size-5" />
          INICIAR MEUS 20 MINUTOS
        </Button>

        <p className="text-muted-foreground text-xs">
          Pode parar antes ou passar do tempo. O que conta é ter feito.
        </p>
      </footer>
    </div>
  );
}
