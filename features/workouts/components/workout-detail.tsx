'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CloudOff, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/session/session-context';
import { removeWorkout } from '@/features/workouts/repository';
import { useWorkout } from '@/features/workouts/use-workout';
import { formatDay } from '@/services/calendar';
import { formatDurationShort } from '@/services/duration';
import { protocolDay } from '@/services/streak';

/** Detalhe de um treino: o que foi feito, quando e por quanto tempo. */
export function WorkoutDetail({ clientId }: { clientId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { protocolStartedOn } = useSession();
  const { data: workout, isLoading } = useWorkout(clientId);
  const [removing, setRemoving] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lg font-bold">Treino não encontrado</p>
        <p className="text-muted-foreground max-w-xs text-sm">
          Ele pode ter sido apagado, ou ainda não foi baixado para este aparelho.
        </p>
        <Button render={<Link href="/historico" />} className="h-12">
          Ver histórico
        </Button>
      </div>
    );
  }

  async function handleDelete() {
    const confirmed = window.confirm('Apagar este treino? Ele sai da sua sequência e do histórico.');
    if (!confirmed) return;

    setRemoving(true);
    try {
      await removeWorkout(clientId);
      await queryClient.invalidateQueries({ queryKey: ['workouts'] });
      toast.success('Treino apagado.');
      router.replace('/historico');
    } catch {
      setRemoving(false);
      toast.error('Não conseguimos apagar agora.', { description: 'Tente novamente.' });
    }
  }

  const day = protocolDay(protocolStartedOn, workout.workout_date);

  return (
    <div className="flex flex-col gap-6 py-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft aria-hidden className="size-4" />
          Voltar
        </Button>

        <div className="flex gap-1">
          <Button
            render={<Link href={`/treino/${clientId}/editar`} />}
            variant="ghost"
            size="icon"
            aria-label="Editar treino"
          >
            <Pencil aria-hidden className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void handleDelete()}
            disabled={removing}
            aria-label="Apagar treino"
          >
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      </div>

      <header className="flex flex-col gap-2">
        <p className="text-primary text-xs font-bold tracking-[0.18em] uppercase">Dia {day}</p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {workout.title ?? workout.template_title ?? 'Treino livre'}
        </h1>
        <p className="text-muted-foreground tnum">
          {formatDay(workout.workout_date)} · {formatDurationShort(workout.duration_seconds)}
          {workout.rounds ? ` · ${workout.rounds} rounds` : ''}
          {workout.effort ? ` · esforço ${workout.effort}/10` : ''}
        </p>

        {workout.sync_state !== 'synced' ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <CloudOff aria-hidden className="size-3.5" />
            {workout.sync_state === 'failed'
              ? 'Falhou ao sincronizar — vamos tentar de novo automaticamente.'
              : 'Aguardando sincronização. Já está salvo no aparelho.'}
          </p>
        ) : null}
      </header>

      {workout.exercises.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Exercícios
          </h2>
          <ul className="border-border divide-border divide-y rounded-xl border">
            {workout.exercises.map((item, index) => (
              <li key={`${item.exercise_id}-${index}`} className="flex justify-between gap-3 p-4">
                <span className="font-medium">{item.exercise_name}</span>
                <span className="text-muted-foreground tnum text-sm">
                  {[
                    item.sets && item.repetitions
                      ? `${item.sets} × ${item.repetitions}`
                      : item.repetitions
                        ? `${item.repetitions}`
                        : null,
                    item.duration_seconds ? `${item.duration_seconds}s` : null,
                    item.distance_meters ? `${item.distance_meters} m` : null,
                    item.weight_kg ? `${item.weight_kg} kg` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {workout.notes ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Observações
          </h2>
          <p className="border-border rounded-xl border p-4 text-sm whitespace-pre-wrap">
            {workout.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
