'use client';

import { createClient } from '@/lib/supabase/client';
import type { LocalWorkout } from '@/types/offline';

/**
 * Salvar um treino como template.
 *
 * Vai direto para o servidor, sem passar pela fila: um template é uma decisão
 * deliberada, e não faz parte do caminho crítico de registrar o treino. Sem
 * rede, o usuário recebe um aviso claro e nada se perde — o treino continua lá.
 */
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
