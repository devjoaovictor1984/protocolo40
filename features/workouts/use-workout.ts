'use client';

import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/session/session-context';
import { getWorkout } from '@/lib/offline/db';
import { createClient } from '@/lib/supabase/client';
import { localWorkouts } from '@/features/workouts/repository';
import { buildRecordBook } from '@/services/records';
import type { RecordMetric } from '@/types/database';

/** Um treino do aparelho. É a fonte da verdade enquanto ele não sincroniza. */
export function useWorkout(clientId: string) {
  const { userId } = useSession();

  return useQuery({
    queryKey: ['workouts', 'item', clientId],
    queryFn: async () => {
      const workout = await getWorkout(clientId);
      return workout && workout.user_id === userId ? workout : null;
    },
    staleTime: 0,
  });
}

export function useLocalWorkouts() {
  const { userId } = useSession();

  return useQuery({
    queryKey: ['workouts', 'list', userId],
    queryFn: () => localWorkouts(userId),
    staleTime: 10_000,
  });
}

/**
 * Melhores marcas atuais, para reconhecer um recorde na hora em que ele
 * acontece. Offline devolve um livro vazio: aí o recorde só aparece depois da
 * sincronização, quando o trigger do banco confirma.
 */
export function useRecordBook() {
  const { userId } = useSession();

  return useQuery({
    queryKey: ['records', 'book', userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('personal_records')
        .select('exercise_id, metric, value')
        .eq('user_id', userId);

      return buildRecordBook(
        (data ?? []).map((row) => ({
          exercise_id: row.exercise_id,
          metric: row.metric as RecordMetric,
          value: Number(row.value),
        })),
      );
    },
    staleTime: 60_000,
    retry: false,
  });
}
