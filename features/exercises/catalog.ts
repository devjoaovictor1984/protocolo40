'use client';

import { useQuery } from '@tanstack/react-query';

import { readCache, writeCache } from '@/lib/offline/db';
import { createClient } from '@/lib/supabase/client';
import type {
  ExerciseCategory,
  ExerciseModality,
  WorkoutLevel,
  WorkoutMethod,
  WorkoutPlace,
} from '@/types/database';

/**
 * Catálogo de exercícios e templates.
 *
 * Fica em cache no IndexedDB porque é a única coisa que o registro de treino
 * precisa do servidor — sem ele, não dá para montar um treino offline.
 */

export type CatalogExercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  modality: ExerciseModality;
  equipment: string[];
  isCustom: boolean;
};

export type CatalogTemplateExercise = {
  exerciseId: string;
  name: string;
  modality: ExerciseModality;
  sets: number | null;
  repetitions: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  weightKg: number | null;
  orderIndex: number;
};

export type CatalogTemplate = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  method: WorkoutMethod;
  level: WorkoutLevel | null;
  place: WorkoutPlace | null;
  tags: string[];
  estimatedSeconds: number;
  isSystem: boolean;
  isFavorite: boolean;
  exercises: CatalogTemplateExercise[];
};

const EXERCISES_KEY = 'catalog:exercises';
const TEMPLATES_KEY = 'catalog:templates';

async function fetchExercises(): Promise<CatalogExercise[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, category, modality, equipment, owner_id')
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('name');

  if (error || !data) {
    // offline ou servidor fora: o catálogo guardado ainda serve
    const cached = await readCache<CatalogExercise[]>(EXERCISES_KEY);
    if (cached) return cached;
    throw error ?? new Error('Não foi possível carregar os exercícios.');
  }

  const exercises = data.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    modality: row.modality,
    equipment: row.equipment,
    isCustom: row.owner_id !== null,
  }));

  await writeCache(EXERCISES_KEY, exercises);
  return exercises;
}

async function fetchTemplates(): Promise<CatalogTemplate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('workout_templates')
    .select(
      'id, title, subtitle, description, method, level, place, tags, estimated_seconds, is_favorite, owner_id, workout_template_exercises(exercise_id, sets, repetitions, duration_seconds, distance_meters, weight_kg, order_index, exercises(name, modality))',
    )
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('title');

  if (error || !data) {
    const cached = await readCache<CatalogTemplate[]>(TEMPLATES_KEY);
    if (cached) return cached;
    throw error ?? new Error('Não foi possível carregar os treinos.');
  }

  const templates: CatalogTemplate[] = data.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    method: row.method,
    level: row.level,
    place: row.place,
    tags: row.tags,
    estimatedSeconds: row.estimated_seconds,
    isSystem: row.owner_id === null,
    isFavorite: row.is_favorite,
    exercises: (row.workout_template_exercises ?? [])
      .map((item) => ({
        exerciseId: item.exercise_id,
        name: item.exercises?.name ?? 'Exercício',
        modality: item.exercises?.modality ?? ('reps' as ExerciseModality),
        sets: item.sets,
        repetitions: item.repetitions,
        durationSeconds: item.duration_seconds,
        distanceMeters: item.distance_meters,
        weightKg: item.weight_kg,
        orderIndex: item.order_index,
      }))
      .sort((a, b) => a.orderIndex - b.orderIndex),
  }));

  await writeCache(TEMPLATES_KEY, templates);
  return templates;
}

/**
 * Cria um exercício do próprio usuário.
 *
 * Precisa de rede: a biblioteca é compartilhada entre aparelhos e o `id` vem do
 * banco. O treino em si continua funcionando offline com o que já está em cache.
 */
export async function createCustomExercise(input: {
  userId: string;
  name: string;
  category: ExerciseCategory;
  modality: ExerciseModality;
}): Promise<CatalogExercise> {
  const name = input.name.trim();

  if (name.length < 2 || name.length > 60) {
    throw new Error('O nome precisa ter entre 2 e 60 caracteres.');
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      owner_id: input.userId,
      name,
      category: input.category,
      modality: input.modality,
    })
    .select('id, name, category, modality, equipment, owner_id')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Você já tem um exercício com esse nome.');
    }
    throw new Error('Não foi possível criar o exercício agora. Verifique sua conexão.');
  }

  return {
    id: data.id,
    name: data.name,
    category: data.category,
    modality: data.modality,
    equipment: data.equipment,
    isCustom: true,
  };
}

export const MODALITY_LABELS: Record<ExerciseModality, string> = {
  reps: 'Repetições',
  time: 'Tempo',
  distance: 'Distância',
  load: 'Carga',
};

export function useExercises() {
  return useQuery({
    queryKey: ['catalog', 'exercises'],
    queryFn: fetchExercises,
    staleTime: 60 * 60 * 1000,
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: ['catalog', 'templates'],
    queryFn: fetchTemplates,
    staleTime: 30 * 60 * 1000,
  });
}

export function useTemplate(id: string | null) {
  const templates = useTemplates();
  return {
    ...templates,
    data: id ? (templates.data?.find((template) => template.id === id) ?? null) : null,
  };
}

/** Descrição curta de um item do treino: "5 × 10", "45s", "1 km". */
export function describeMetrics(item: {
  sets: number | null;
  repetitions: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  weightKg: number | null;
}): string {
  const parts: string[] = [];

  if (item.repetitions !== null) {
    parts.push(item.sets && item.sets > 1 ? `${item.sets} × ${item.repetitions}` : `${item.repetitions}`);
  }
  if (item.durationSeconds !== null) {
    parts.push(item.durationSeconds >= 60 ? `${Math.round(item.durationSeconds / 60)} min` : `${item.durationSeconds}s`);
  }
  if (item.distanceMeters !== null) {
    parts.push(item.distanceMeters >= 1000 ? `${(item.distanceMeters / 1000).toFixed(1)} km` : `${item.distanceMeters} m`);
  }
  if (item.weightKg !== null) {
    parts.push(`${item.weightKg} kg`);
  }

  return parts.join(' · ');
}

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombros: 'Ombros',
  bracos: 'Braços',
  pernas: 'Pernas',
  abdomen: 'Abdômen',
  cardio: 'Cardio',
  mobilidade: 'Mobilidade',
  corpo_inteiro: 'Corpo inteiro',
};
