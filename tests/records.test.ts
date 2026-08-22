import { describe, expect, it } from 'vitest';

import { buildRecordBook, detectRecords, totalRepetitions } from '@/services/records';

const FLEXAO = '11111111-1111-4111-8111-111111111111';
const BARRA = '22222222-2222-4222-8222-222222222222';

type ExerciseInput = {
  exerciseId: string;
  sets: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  weight_kg: number | null;
};

const metrics = (over: Partial<ExerciseInput> & { exerciseId: string }): ExerciseInput => ({
  sets: null,
  repetitions: null,
  duration_seconds: null,
  distance_meters: null,
  weight_kg: null,
  ...over,
});

describe('totalRepetitions', () => {
  it('multiplica séries por repetições', () => {
    expect(totalRepetitions({ sets: 4, repetitions: 12 })).toBe(48);
  });

  it('assume uma série quando não há séries', () => {
    expect(totalRepetitions({ sets: null, repetitions: 10 })).toBe(10);
  });

  it('devolve null quando não há repetições', () => {
    expect(totalRepetitions({ sets: 3, repetitions: null })).toBeNull();
  });
});

describe('detectRecords', () => {
  const emptyBook = buildRecordBook([]);

  it('o primeiro treino já vira recorde de duração', () => {
    const records = detectRecords(
      { durationSeconds: 1200, rounds: null, exercises: [] },
      emptyBook,
    );
    expect(records).toEqual([
      { exerciseId: null, metric: 'duration', value: 1200, unit: 'segundos', previousValue: null },
    ]);
  });

  it('não repete recorde quando o valor apenas empata', () => {
    const book = buildRecordBook([{ exercise_id: null, metric: 'duration', value: 1200 }]);
    const records = detectRecords({ durationSeconds: 1200, rounds: null, exercises: [] }, book);
    expect(records).toHaveLength(0);
  });

  it('registra o valor anterior ao bater um recorde', () => {
    const book = buildRecordBook([{ exercise_id: null, metric: 'rounds', value: 8 }]);
    const records = detectRecords({ durationSeconds: 600, rounds: 10, exercises: [] }, book);

    expect(records).toContainEqual({
      exerciseId: null,
      metric: 'rounds',
      value: 10,
      unit: 'rounds',
      previousValue: 8,
    });
  });

  it('detecta recorde por exercício', () => {
    const book = buildRecordBook([{ exercise_id: FLEXAO, metric: 'reps', value: 80 }]);
    const records = detectRecords(
      {
        durationSeconds: 1200,
        rounds: null,
        exercises: [metrics({ exerciseId: FLEXAO, sets: 10, repetitions: 10 })],
      },
      book,
    );

    expect(records).toContainEqual({
      exerciseId: FLEXAO,
      metric: 'reps',
      value: 100,
      unit: 'repetições',
      previousValue: 80,
    });
  });

  it('mantém apenas o maior valor quando o exercício se repete no treino', () => {
    const records = detectRecords(
      {
        durationSeconds: 1200,
        rounds: null,
        exercises: [
          metrics({ exerciseId: BARRA, sets: 1, repetitions: 5 }),
          metrics({ exerciseId: BARRA, sets: 1, repetitions: 8 }),
        ],
      },
      emptyBook,
    );

    const barraReps = records.filter((r) => r.exerciseId === BARRA && r.metric === 'reps');
    expect(barraReps).toHaveLength(1);
    expect(barraReps[0].value).toBe(8);
  });

  it('ignora métricas ausentes ou zeradas', () => {
    const records = detectRecords(
      {
        durationSeconds: 900,
        rounds: 0,
        exercises: [metrics({ exerciseId: FLEXAO, repetitions: 20 })],
      },
      emptyBook,
    );

    expect(records.some((r) => r.metric === 'rounds')).toBe(false);
    expect(records.some((r) => r.metric === 'weight')).toBe(false);
  });

  it('separa recordes por métrica no mesmo exercício', () => {
    const records = detectRecords(
      {
        durationSeconds: 1200,
        rounds: null,
        exercises: [
          metrics({ exerciseId: BARRA, sets: 5, repetitions: 6, weight_kg: 12.5 }),
        ],
      },
      emptyBook,
    );

    const forBarra = records.filter((r) => r.exerciseId === BARRA).map((r) => r.metric).sort();
    expect(forBarra).toEqual(['reps', 'weight']);
  });
});
