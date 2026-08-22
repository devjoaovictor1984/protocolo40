'use client';

import {
  deleteWorkout as deleteLocalWorkout,
  getWorkout,
  listWorkouts,
  putWorkout,
} from '@/lib/offline/db';
import { enqueue } from '@/lib/offline/queue';
import { createClient } from '@/lib/supabase/client';
import type { WorkoutPlace } from '@/types/database';
import type { LocalWorkout, LocalWorkoutExercise } from '@/types/offline';

/**
 * Escrita local-first de treinos.
 *
 * O treino é gravado no aparelho e só então entra na fila. Entre terminar o
 * cronômetro e ver "TREINO CONCLUÍDO" não existe rede: é isso que garante que
 * nenhum treino se perde por falta de conexão.
 */

export type SaveWorkoutInput = {
  clientId: string;
  userId: string;
  templateId: string | null;
  templateTitle: string | null;
  title: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number;
  workoutDate: string;
  rounds: number | null;
  effort: number | null;
  location: WorkoutPlace | null;
  notes: string | null;
  exercises: LocalWorkoutExercise[];
};

function toLocal(input: SaveWorkoutInput, previous?: LocalWorkout | null): LocalWorkout {
  return {
    client_id: input.clientId,
    user_id: input.userId,
    remote_id: previous?.remote_id ?? null,
    template_id: input.templateId,
    template_title: input.templateTitle,
    title: input.title,
    notes: input.notes,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    duration_seconds: input.durationSeconds,
    workout_date: input.workoutDate,
    rounds: input.rounds,
    effort: input.effort,
    location: input.location,
    exercises: input.exercises,
    sync_state: 'pending',
    sync_error: null,
    updated_at: Date.now(),
  };
}

/** Grava o treino no aparelho e enfileira o envio. Nunca lança por falta de rede. */
export async function saveWorkout(input: SaveWorkoutInput): Promise<LocalWorkout> {
  const previous = await getWorkout(input.clientId);
  const workout = toLocal(input, previous);

  await putWorkout(workout);
  await enqueue(previous ? 'UPDATE_WORKOUT' : 'CREATE_WORKOUT', workout.client_id);

  return workout;
}

export async function updateWorkoutFields(
  clientId: string,
  patch: Partial<Pick<LocalWorkout, 'title' | 'notes' | 'rounds' | 'effort' | 'location' | 'exercises'>>,
): Promise<LocalWorkout | null> {
  const current = await getWorkout(clientId);
  if (!current) return null;

  const updated: LocalWorkout = {
    ...current,
    ...patch,
    sync_state: 'pending',
    sync_error: null,
    updated_at: Date.now(),
  };

  await putWorkout(updated);
  await enqueue('UPDATE_WORKOUT', clientId);

  return updated;
}

export async function removeWorkout(clientId: string): Promise<void> {
  const workout = await getWorkout(clientId);
  if (!workout) return;

  if (workout.remote_id) {
    // já existe no servidor: precisa de um soft delete lá também
    await putWorkout({ ...workout, sync_state: 'pending', updated_at: Date.now() });
    await enqueue('DELETE_WORKOUT', clientId);
  } else {
    await deleteLocalWorkout(clientId);
  }
}

/** Treinos do aparelho, do mais recente para o mais antigo. */
export async function localWorkouts(userId: string): Promise<LocalWorkout[]> {
  return listWorkouts(userId);
}

/** Os que ainda não chegaram ao servidor — o que a interface chama de pendentes. */
export async function unsyncedWorkouts(userId: string): Promise<LocalWorkout[]> {
  const all = await listWorkouts(userId);
  return all.filter((workout) => workout.sync_state !== 'synced');
}

export async function workoutsOn(userId: string, day: string): Promise<LocalWorkout[]> {
  const all = await listWorkouts(userId);
  return all.filter((workout) => workout.workout_date === day);
}

/**
 * Traz do servidor os treinos recentes e guarda no aparelho.
 *
 * É o que permite o dashboard e o calendário abrirem offline depois da
 * primeira visita. Só sobrescreve o que já está sincronizado: um treino ainda
 * pendente no aparelho é mais novo que qualquer coisa vinda do servidor.
 */
export async function hydrateWorkouts(userId: string, sinceDay: string): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('workouts')
    .select(
      'id, client_id, template_id, title, notes, started_at, finished_at, duration_seconds, workout_date, rounds, effort, location, workout_exercises(exercise_id, sets, repetitions, duration_seconds, distance_meters, weight_kg, order_index, notes, exercises(name))',
    )
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('workout_date', sinceDay)
    .order('started_at', { ascending: false })
    .limit(200);

  if (error || !data) return 0;

  let stored = 0;

  for (const row of data) {
    const existing = await getWorkout(row.client_id);
    if (existing && existing.sync_state !== 'synced') continue;

    const exercises: LocalWorkoutExercise[] = (row.workout_exercises ?? [])
      .map((item) => ({
        exercise_id: item.exercise_id,
        exercise_name: item.exercises?.name ?? 'Exercício',
        sets: item.sets,
        repetitions: item.repetitions,
        duration_seconds: item.duration_seconds,
        distance_meters: item.distance_meters,
        weight_kg: item.weight_kg,
        order_index: item.order_index,
        notes: item.notes,
      }))
      .sort((a, b) => a.order_index - b.order_index);

    await putWorkout({
      client_id: row.client_id,
      user_id: userId,
      remote_id: row.id,
      template_id: row.template_id,
      template_title: existing?.template_title ?? null,
      title: row.title,
      notes: row.notes,
      started_at: row.started_at,
      finished_at: row.finished_at,
      duration_seconds: row.duration_seconds,
      workout_date: row.workout_date,
      rounds: row.rounds,
      effort: row.effort,
      location: row.location,
      exercises,
      sync_state: 'synced',
      sync_error: null,
      updated_at: Date.now(),
    });

    stored += 1;
  }

  return stored;
}
