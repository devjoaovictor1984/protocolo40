'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession, useToday } from '@/features/session/session-context';
import { hydrateMeasurements } from '@/features/measurements/repository';
import { hydrateWorkouts, localWorkouts } from '@/features/workouts/repository';
import { addDays } from '@/services/calendar';
import { useRestDays } from '@/features/rest/use-rest-days';
import { calculateStreak, protocolDay } from '@/services/streak';
import type { LocalWorkout } from '@/types/offline';

/**
 * Dados do dashboard.
 *
 * Lê do IndexedDB, não do servidor: é isso que faz a tela abrir offline com
 * números corretos, inclusive contando um treino que ainda não subiu. A carga
 * do servidor acontece em segundo plano e só atualiza o que já está sincronizado.
 */

const HYDRATE_WINDOW_DAYS = 120;

export type DashboardData = {
  workouts: LocalWorkout[];
  todayWorkouts: LocalWorkout[];
  lastWorkout: LocalWorkout | null;
  days: string[];
  streak: ReturnType<typeof calculateStreak>;
  protocolDay: number;
  totalSeconds: number;
  pending: number;
};

export function useDashboard() {
  const { userId, protocolStartedOn } = useSession();
  const today = useToday();
  const queryClient = useQueryClient();

  // busca em segundo plano; a tela não espera por ela
  useEffect(() => {
    let alive = true;

    const run = async () => {
      const since = addDays(today, -HYDRATE_WINDOW_DAYS);
      const stored = await hydrateWorkouts(userId, since);
      await hydrateMeasurements(userId);

      if (alive && stored > 0) {
        void queryClient.invalidateQueries({ queryKey: ['workouts'] });
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [queryClient, today, userId]);

  // o descanso é elo da sequência: sem ele aqui, a tela de Hoje quebrava a
  // corrente de quem tinha registrado descanso — o oposto do que o recurso
  // promete — enquanto o perfil público a mostrava inteira
  const { data: descansos } = useRestDays();

  return useQuery<DashboardData>({
    queryKey: ['workouts', 'dashboard', userId, today, descansos?.length ?? 0],
    queryFn: async () => {
      const workouts = await localWorkouts(userId);
      const days = [...new Set(workouts.map((workout) => workout.workout_date))];

      return {
        workouts,
        todayWorkouts: workouts.filter((workout) => workout.workout_date === today),
        lastWorkout: workouts[0] ?? null,
        days,
        streak: calculateStreak(days, today, descansos ?? []),
        protocolDay: protocolDay(protocolStartedOn, today),
        totalSeconds: workouts.reduce((total, workout) => total + workout.duration_seconds, 0),
        pending: workouts.filter((workout) => workout.sync_state !== 'synced').length,
      };
    },
    staleTime: 5_000,
  });
}
