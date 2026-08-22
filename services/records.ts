/**
 * Recordes pessoais.
 *
 * Quem grava recorde de verdade é o trigger no Postgres — assim ninguém forja um
 * recorde chamando a API direto. Estas funções são o espelho da mesma regra, e
 * servem para mostrar "🔥 NOVO RECORDE" na tela de finalização antes mesmo de a
 * sincronização acontecer.
 */

import type { ExerciseMetrics, RecordMetric } from '@/types/database';

export type RecordCandidate = {
  exerciseId: string | null;
  metric: RecordMetric;
  value: number;
  unit: string;
};

export type NewRecord = RecordCandidate & { previousValue: number | null };

/** Melhor marca conhecida por `${exerciseId ?? 'workout'}:${metric}`. */
export type RecordBook = ReadonlyMap<string, number>;

export function recordKey(exerciseId: string | null, metric: RecordMetric): string {
  return `${exerciseId ?? 'workout'}:${metric}`;
}

export function buildRecordBook(
  entries: readonly { exercise_id: string | null; metric: RecordMetric; value: number }[],
): RecordBook {
  const book = new Map<string, number>();
  for (const entry of entries) {
    const key = recordKey(entry.exercise_id, entry.metric);
    const best = book.get(key);
    if (best === undefined || entry.value > best) {
      book.set(key, entry.value);
    }
  }
  return book;
}

type WorkoutSummary = {
  durationSeconds: number;
  rounds: number | null;
  exercises: readonly (Pick<
    ExerciseMetrics,
    'sets' | 'repetitions' | 'duration_seconds' | 'distance_meters' | 'weight_kg'
  > & { exerciseId: string })[];
};

/** Repetições totais do exercício no treino: séries × repetições. */
export function totalRepetitions(metrics: Pick<ExerciseMetrics, 'sets' | 'repetitions'>): number | null {
  if (metrics.repetitions === null) return null;
  return (metrics.sets ?? 1) * metrics.repetitions;
}

function candidatesFor(workout: WorkoutSummary): RecordCandidate[] {
  const candidates: RecordCandidate[] = [
    { exerciseId: null, metric: 'duration', value: workout.durationSeconds, unit: 'segundos' },
  ];

  if (workout.rounds !== null && workout.rounds > 0) {
    candidates.push({ exerciseId: null, metric: 'rounds', value: workout.rounds, unit: 'rounds' });
  }

  for (const exercise of workout.exercises) {
    const reps = totalRepetitions(exercise);
    const pairs: [RecordMetric, number | null, string][] = [
      ['reps', reps, 'repetições'],
      ['weight', exercise.weight_kg, 'kg'],
      ['distance', exercise.distance_meters, 'metros'],
      ['duration', exercise.duration_seconds, 'segundos'],
    ];

    for (const [metric, value, unit] of pairs) {
      if (value !== null && value > 0) {
        candidates.push({ exerciseId: exercise.exerciseId, metric, value, unit });
      }
    }
  }

  return candidates;
}

/**
 * Recordes batidos por este treino.
 *
 * Quando o mesmo exercício aparece duas vezes no treino, só o maior valor conta
 * — dois registros de recorde para a mesma métrica no mesmo treino seriam ruído.
 */
export function detectRecords(workout: WorkoutSummary, book: RecordBook): NewRecord[] {
  const best = new Map<string, RecordCandidate>();

  for (const candidate of candidatesFor(workout)) {
    const key = recordKey(candidate.exerciseId, candidate.metric);
    const current = best.get(key);
    if (!current || candidate.value > current.value) {
      best.set(key, candidate);
    }
  }

  const records: NewRecord[] = [];

  for (const [key, candidate] of best) {
    const previous = book.get(key) ?? null;
    if (previous === null || candidate.value > previous) {
      records.push({ ...candidate, previousValue: previous });
    }
  }

  return records;
}

const METRIC_LABEL: Record<RecordMetric, string> = {
  reps: 'repetições',
  duration: 'duração',
  distance: 'distância',
  weight: 'carga',
  rounds: 'rounds',
  volume: 'volume',
};

export function metricLabel(metric: RecordMetric): string {
  return METRIC_LABEL[metric];
}
