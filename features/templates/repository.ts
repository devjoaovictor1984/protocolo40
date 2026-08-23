'use client';

import { createClient } from '@/lib/supabase/client';
import type { WorkoutLevel } from '@/types/database';
import type { LocalWorkout, LocalWorkoutExercise } from '@/types/offline';

/**
 * Treinos próprios.
 *
 * Vão direto para o servidor, sem passar pela fila: montar ou salvar um treino
 * é uma decisão deliberada e não faz parte do caminho crítico de registrar o
 * treino do dia. Sem rede, o aviso é claro e nada se perde.
 */

export type NewTemplate = {
  userId: string;
  title: string;
  description: string | null;
  level: WorkoutLevel;
  tags: string[];
  estimatedSeconds: number;
  exercises: LocalWorkoutExercise[];
};

/**
 * Cria um treino do zero.
 *
 * Nasce favorito porque quem monta um treino quer encontrá-lo depois. O método
 * é o mesmo de toda a biblioteca — repetir o circuito no tempo —, então nem
 * entra no formulário.
 */
export async function createTemplate(input: NewTemplate): Promise<string> {
  const title = input.title.trim();

  if (title.length < 2 || title.length > 80) {
    throw new Error('O nome precisa ter entre 2 e 80 caracteres.');
  }
  if (input.exercises.length === 0) {
    throw new Error('Adicione ao menos um exercício ao circuito.');
  }

  const supabase = createClient();

  const { data: template, error } = await supabase
    .from('workout_templates')
    .insert({
      owner_id: input.userId,
      title,
      description: input.description,
      level: input.level,
      tags: input.tags,
      estimated_seconds: input.estimatedSeconds,
      method: 'amrap',
      is_favorite: true,
    })
    .select('id')
    .single();

  if (error || !template) {
    throw new Error('Não foi possível salvar o treino agora. Verifique sua conexão.');
  }

  const { error: itemsError } = await supabase.from('workout_template_exercises').insert(
    input.exercises.map((item, index) => ({
      template_id: template.id,
      exercise_id: item.exercise_id,
      sets: item.sets,
      repetitions: item.repetitions,
      duration_seconds: item.duration_seconds,
      distance_meters: item.distance_meters,
      weight_kg: item.weight_kg,
      order_index: index,
      notes: item.notes,
    })),
  );

  if (itemsError) {
    // sem os exercícios o treino não serve para nada: desfaz
    await supabase.from('workout_templates').delete().eq('id', template.id);
    throw new Error('Não foi possível salvar os exercícios do circuito.');
  }

  return template.id;
}

/** Transforma um treino já executado num template reutilizável. */
export async function saveWorkoutAsTemplate(
  workout: LocalWorkout,
  input: { userId: string; title: string },
): Promise<string> {
  const title = input.title.trim();

  if (title.length < 2 || title.length > 80) {
    throw new Error('O nome precisa ter entre 2 e 80 caracteres.');
  }
  if (workout.exercises.length === 0) {
    throw new Error('Adicione ao menos um exercício antes de salvar como treino.');
  }

  const supabase = createClient();

  const { data: template, error } = await supabase
    .from('workout_templates')
    .insert({
      owner_id: input.userId,
      title,
      description: workout.notes,
      place: workout.location,
      estimated_seconds: workout.duration_seconds,
      method: 'amrap',
      is_favorite: true,
    })
    .select('id')
    .single();

  if (error || !template) {
    throw new Error('Não foi possível salvar o treino agora. Verifique sua conexão.');
  }

  const { error: itemsError } = await supabase.from('workout_template_exercises').insert(
    workout.exercises.map((item, index) => ({
      template_id: template.id,
      exercise_id: item.exercise_id,
      // rounds viram séries no template: repetir o circuito é a ideia
      sets: workout.rounds && workout.rounds > 0 ? null : item.sets,
      repetitions: item.repetitions,
      duration_seconds: item.duration_seconds,
      distance_meters: item.distance_meters,
      weight_kg: item.weight_kg,
      order_index: index,
      notes: item.notes,
    })),
  );

  if (itemsError) {
    // sem os exercícios o template não serve para nada: desfaz
    await supabase.from('workout_templates').delete().eq('id', template.id);
    throw new Error('Não foi possível salvar os exercícios do treino.');
  }

  return template.id;
}
