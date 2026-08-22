import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { RecordMetric } from '@/types/database';

/**
 * Recordes pessoais, lidos no servidor.
 *
 * Existem só depois da sincronização, porque quem os grava é o trigger do
 * banco — o cliente não tem permissão de inserir em `personal_records`.
 */

export type RecordEntry = {
  id: string;
  metric: RecordMetric;
  value: number;
  unit: string | null;
  achievedOn: string;
  previousValue: number | null;
  exerciseId: string | null;
  exerciseName: string | null;
};

export type RecordGroup = {
  key: string;
  title: string;
  metric: RecordMetric;
  current: RecordEntry;
  history: RecordEntry[];
};

const METRIC_TITLES: Record<RecordMetric, string> = {
  reps: 'Mais repetições',
  duration: 'Maior duração',
  distance: 'Maior distância',
  weight: 'Maior carga',
  rounds: 'Mais rounds',
  volume: 'Maior volume',
};

export async function listRecords(userId: string): Promise<RecordGroup[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('personal_records')
    .select('id, metric, value, unit, achieved_on, previous_value, exercise_id, exercises(name)')
    .eq('user_id', userId)
    .order('value', { ascending: false });

  if (!data) return [];

  const entries: RecordEntry[] = data.map((row) => ({
    id: row.id,
    metric: row.metric,
    value: Number(row.value),
    unit: row.unit,
    achievedOn: row.achieved_on,
    previousValue: row.previous_value === null ? null : Number(row.previous_value),
    exerciseId: row.exercise_id,
    exerciseName: row.exercises?.name ?? null,
  }));

  // agrupa por exercício + métrica; o maior valor é o recorde atual
  const groups = new Map<string, RecordEntry[]>();
  for (const entry of entries) {
    const key = `${entry.exerciseId ?? 'treino'}:${entry.metric}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return [...groups.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => b.value - a.value);
      const current = sorted[0];

      return {
        key,
        metric: current.metric,
        title: current.exerciseName
          ? `${current.exerciseName} — ${METRIC_TITLES[current.metric].toLowerCase()}`
          : METRIC_TITLES[current.metric],
        current,
        history: [...list].sort((a, b) => b.achievedOn.localeCompare(a.achievedOn)),
      };
    })
    .sort((a, b) => b.current.achievedOn.localeCompare(a.current.achievedOn));
}

/** `1200 segundos` vira `20 min`; metros viram km quando passa de mil. */
export function formatRecordValue(entry: RecordEntry): string {
  const value = entry.value;

  if (entry.metric === 'duration') {
    return value >= 60 ? `${Math.round(value / 60)} min` : `${value} s`;
  }
  if (entry.metric === 'distance') {
    return value >= 1000 ? `${(value / 1000).toFixed(1).replace('.', ',')} km` : `${value} m`;
  }
  if (entry.metric === 'weight') {
    return `${value.toFixed(1).replace('.', ',')} kg`;
  }

  return `${value} ${entry.unit ?? ''}`.trim();
}
