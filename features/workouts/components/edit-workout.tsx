'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { WorkoutForm } from '@/features/workouts/components/workout-form';
import { useWorkout } from '@/features/workouts/use-workout';

/** Carrega o treino do aparelho antes de montar o formulário de edição. */
export function EditWorkout({ clientId }: { clientId: string }) {
  const { data: workout, isLoading } = useWorkout(clientId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!workout) {
    return (
      <p className="text-muted-foreground py-16 text-center">
        Treino não encontrado neste aparelho.
      </p>
    );
  }

  return <WorkoutForm workout={workout} />;
}
