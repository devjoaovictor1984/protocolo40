/**
 * Agregações da evolução.
 *
 * Funções puras sobre listas já carregadas: entram registros, saem séries
 * prontas para o gráfico. Nenhuma consulta, nenhum `Date.now()` escondido.
 */

import { addDays, formatDayShort, startOfWeek } from '@/services/calendar';

export type Series = { label: string; value: number; caption?: string }[];

type WorkoutLike = {
  workout_date: string;
  duration_seconds: number;
  exercises: {
    exercise_id: string;
    sets: number | null;
    repetitions: number | null;
    duration_seconds: number | null;
    distance_meters: number | null;
  }[];
};

type MeasurementLike = {
  measured_on: string;
  weight_kg: number | null;
};

/** As últimas `count` semanas, da mais antiga para a mais recente. */
function weekStarts(today: string, count: number): string[] {
  const current = startOfWeek(today);
  return Array.from({ length: count }, (_, index) => addDays(current, (index - count + 1) * 7));
}

function weekCaption(start: string): string {
  return `Semana de ${formatDayShort(start)}`;
}

/** Peso registrado ao longo do tempo. Dias sem registro simplesmente não entram. */
export function weightSeries(measurements: readonly MeasurementLike[], limit = 60): Series {
  return measurements
    .filter((item) => item.weight_kg !== null)
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on))
    .slice(-limit)
    .map((item) => ({
      label: formatDayShort(item.measured_on),
      value: item.weight_kg as number,
      caption: item.measured_on.split('-').reverse().join('/'),
    }));
}

/** Quantos dias com treino em cada semana. Dois treinos no mesmo dia contam um. */
export function weeklyWorkoutDays(
  workouts: readonly WorkoutLike[],
  today: string,
  weeks = 12,
): Series {
  const starts = weekStarts(today, weeks);
  const daysByWeek = new Map<string, Set<string>>();

  for (const workout of workouts) {
    const start = startOfWeek(workout.workout_date);
    const set = daysByWeek.get(start) ?? new Set<string>();
    set.add(workout.workout_date);
    daysByWeek.set(start, set);
  }

  return starts.map((start) => ({
    label: formatDayShort(start),
    value: daysByWeek.get(start)?.size ?? 0,
    caption: weekCaption(start),
  }));
}

/** Minutos treinados por semana. */
export function weeklyMinutes(workouts: readonly WorkoutLike[], today: string, weeks = 12): Series {
  const starts = weekStarts(today, weeks);
  const totals = new Map<string, number>();

  for (const workout of workouts) {
    const start = startOfWeek(workout.workout_date);
    totals.set(start, (totals.get(start) ?? 0) + workout.duration_seconds);
  }

  return starts.map((start) => ({
    label: formatDayShort(start),
    value: Math.round((totals.get(start) ?? 0) / 60),
    caption: weekCaption(start),
  }));
}

/**
 * Volume de um exercício por semana.
 *
 * Volume é o total de repetições (séries × repetições). Para exercícios medidos
 * por tempo ou distância, é o total de segundos ou de metros.
 */
export function exerciseVolume(
  workouts: readonly WorkoutLike[],
  exerciseId: string,
  today: string,
  weeks = 12,
): { series: Series; unit: string } {
  const starts = weekStarts(today, weeks);
  const totals = new Map<string, number>();
  let unit = 'repetições';

  for (const workout of workouts) {
    const start = startOfWeek(workout.workout_date);

    for (const item of workout.exercises) {
      if (item.exercise_id !== exerciseId) continue;

      let amount = 0;
      if (item.repetitions !== null) {
        amount = (item.sets ?? 1) * item.repetitions;
      } else if (item.duration_seconds !== null) {
        amount = (item.sets ?? 1) * item.duration_seconds;
        unit = 'segundos';
      } else if (item.distance_meters !== null) {
        amount = (item.sets ?? 1) * item.distance_meters;
        unit = 'metros';
      }

      totals.set(start, (totals.get(start) ?? 0) + amount);
    }
  }

  return {
    unit,
    series: starts.map((start) => ({
      label: formatDayShort(start),
      value: totals.get(start) ?? 0,
      caption: weekCaption(start),
    })),
  };
}

/** Exercícios que aparecem nos treinos, do mais frequente para o menos. */
export function exercisesUsed(
  workouts: readonly WorkoutLike[],
): { exerciseId: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const workout of workouts) {
    for (const item of workout.exercises) {
      counts.set(item.exercise_id, (counts.get(item.exercise_id) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([exerciseId, count]) => ({ exerciseId, count }))
    .sort((a, b) => b.count - a.count);
}

/** Diferença de peso entre o primeiro e o último registro. */
export function weightDelta(measurements: readonly MeasurementLike[]): number | null {
  const withWeight = measurements
    .filter((item) => item.weight_kg !== null)
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on));

  if (withWeight.length < 2) return null;

  return (
    (withWeight[withWeight.length - 1].weight_kg as number) - (withWeight[0].weight_kg as number)
  );
}

/**
 * O peso de cada dia, para casar com o que aconteceu naquele dia.
 *
 * Existe porque o peso morava em dois lugares que não conversavam: a medida do
 * dia (`body_measurements`, escrita pelo cartão de Hoje e pela tela de Medidas)
 * e uma cópia gravada junto da foto, preenchida só quando o peso era digitado
 * na tela de finalizar treino. Quem registrava o peso pela manhã e tirava a
 * foto depois via "Sem peso registrado" embaixo da própria foto, e a tela de
 * comparar não conseguia calcular a diferença.
 *
 * A medida do dia é a fonte: ela é editável e é onde a correção acontece. A
 * cópia da foto vira só reserva, para o que foi tirado antes disto existir.
 */
export function weightByDay(
  measurements: readonly MeasurementLike[],
): Map<string, number> {
  const mapa = new Map<string, number>();

  for (const item of measurements) {
    if (item.weight_kg === null || item.weight_kg === undefined) continue;
    // a última leitura de um mesmo dia vence; o upsert garante uma só, mas a
    // fila offline pode entregar duas antes de sincronizar
    mapa.set(item.measured_on, item.weight_kg);
  }

  return mapa;
}

/** O peso que vale para um dia: o registrado nele, ou o que veio junto do item. */
export function weightForDay(
  porDia: Map<string, number>,
  day: string,
  reserva: number | null = null,
): number | null {
  return porDia.get(day) ?? reserva;
}
