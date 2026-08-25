import { describe, expect, it } from 'vitest';

import {
  exerciseVolume,
  exercisesUsed,
  weeklyMinutes,
  weeklyWorkoutDays,
  weightByDay,
  weightDelta,
  weightForDay,
  weightSeries,
} from '@/services/progress';
import { suggestFocus } from '@/services/suggestions';

const FLEXAO = 'ex-flexao';
const CORRIDA = 'ex-corrida';

const workout = (
  date: string,
  seconds: number,
  exercises: {
    exercise_id: string;
    sets?: number | null;
    repetitions?: number | null;
    duration_seconds?: number | null;
    distance_meters?: number | null;
  }[] = [],
) => ({
  workout_date: date,
  duration_seconds: seconds,
  exercises: exercises.map((item) => ({
    exercise_id: item.exercise_id,
    sets: item.sets ?? null,
    repetitions: item.repetitions ?? null,
    duration_seconds: item.duration_seconds ?? null,
    distance_meters: item.distance_meters ?? null,
  })),
});

describe('weightSeries', () => {
  it('ordena por data e ignora registros sem peso', () => {
    const series = weightSeries([
      { measured_on: '2026-08-03', weight_kg: 90.8 },
      { measured_on: '2026-08-01', weight_kg: 92 },
      { measured_on: '2026-08-02', weight_kg: null },
    ]);

    expect(series.map((point) => point.value)).toEqual([92, 90.8]);
  });
});

describe('weightDelta', () => {
  it('compara o primeiro com o último registro', () => {
    const delta = weightDelta([
      { measured_on: '2026-06-01', weight_kg: 92 },
      { measured_on: '2026-07-30', weight_kg: 86.4 },
    ]);

    expect(delta).toBeCloseTo(-5.6);
  });

  it('devolve null com menos de dois registros', () => {
    expect(weightDelta([{ measured_on: '2026-06-01', weight_kg: 92 }])).toBeNull();
  });
});

describe('weeklyWorkoutDays', () => {
  it('conta dias distintos, não treinos', () => {
    // 2026-08-17 é uma segunda; dois treinos no mesmo dia contam um só
    const series = weeklyWorkoutDays(
      [workout('2026-08-17', 1200), workout('2026-08-17', 900), workout('2026-08-19', 1200)],
      '2026-08-22',
      2,
    );

    expect(series.at(-1)?.value).toBe(2);
  });

  it('devolve a quantidade de semanas pedida, mesmo vazias', () => {
    expect(weeklyWorkoutDays([], '2026-08-22', 6)).toHaveLength(6);
    expect(weeklyWorkoutDays([], '2026-08-22', 6).every((point) => point.value === 0)).toBe(true);
  });
});

describe('weeklyMinutes', () => {
  it('soma a duração da semana em minutos', () => {
    const series = weeklyMinutes(
      [workout('2026-08-17', 1200), workout('2026-08-18', 600)],
      '2026-08-22',
      1,
    );

    expect(series.at(-1)?.value).toBe(30);
  });
});

describe('exerciseVolume', () => {
  it('multiplica séries por repetições', () => {
    const { series, unit } = exerciseVolume(
      [workout('2026-08-17', 1200, [{ exercise_id: FLEXAO, sets: 10, repetitions: 10 }])],
      FLEXAO,
      '2026-08-22',
      1,
    );

    expect(series.at(-1)?.value).toBe(100);
    expect(unit).toBe('repetições');
  });

  it('usa metros quando o exercício é de distância', () => {
    const { series, unit } = exerciseVolume(
      [workout('2026-08-17', 1200, [{ exercise_id: CORRIDA, distance_meters: 3000 }])],
      CORRIDA,
      '2026-08-22',
      1,
    );

    expect(series.at(-1)?.value).toBe(3000);
    expect(unit).toBe('metros');
  });

  it('ignora outros exercícios', () => {
    const { series } = exerciseVolume(
      [workout('2026-08-17', 1200, [{ exercise_id: CORRIDA, distance_meters: 3000 }])],
      FLEXAO,
      '2026-08-22',
      1,
    );

    expect(series.at(-1)?.value).toBe(0);
  });
});

describe('exercisesUsed', () => {
  it('ordena pelo mais frequente', () => {
    const used = exercisesUsed([
      workout('2026-08-17', 1200, [{ exercise_id: FLEXAO, repetitions: 10 }]),
      workout('2026-08-18', 1200, [{ exercise_id: FLEXAO, repetitions: 10 }]),
      workout('2026-08-19', 1200, [{ exercise_id: CORRIDA, distance_meters: 2000 }]),
    ]);

    expect(used[0]).toEqual({ exerciseId: FLEXAO, count: 2 });
  });
});

describe('suggestFocus', () => {
  it('aponta o que ficou de fora depois de dias repetindo o mesmo grupo', () => {
    const suggestion = suggestFocus(
      [
        { day: '2026-08-21', categories: ['peito', 'bracos'] },
        { day: '2026-08-22', categories: ['costas', 'ombros'] },
      ],
      '2026-08-22',
    );

    expect(suggestion?.message).toContain('membros superiores');
    expect(suggestion?.prefer).toContain('inferiores');
  });

  it('não sugere nada sem histórico recente', () => {
    expect(suggestFocus([], '2026-08-22')).toBeNull();
  });

  it('ignora dias fora da janela', () => {
    const suggestion = suggestFocus(
      [{ day: '2026-07-01', categories: ['peito', 'costas'] }],
      '2026-08-22',
    );

    expect(suggestion).toBeNull();
  });

  it('fica calado quando o treino já é variado', () => {
    const suggestion = suggestFocus(
      [
        { day: '2026-08-21', categories: ['peito', 'pernas', 'abdomen', 'cardio'] },
        { day: '2026-08-22', categories: ['costas', 'pernas', 'abdomen', 'cardio'] },
      ],
      '2026-08-22',
    );

    expect(suggestion).toBeNull();
  });
});

/**
 * O peso morava em dois lugares que não conversavam.
 *
 * A medida do dia era escrita pelo cartão de Hoje e pela tela de Medidas; a
 * foto guardava uma cópia própria, preenchida só quando o peso era digitado na
 * tela de finalizar treino. Quem pesava de manhã e fotografava à noite via
 * "Sem peso registrado" embaixo da própria foto, e a tela de comparar não
 * conseguia calcular a diferença entre antes e depois.
 */
describe('o peso que vale para um dia', () => {
  const medidas = [
    { measured_on: '2026-08-20', weight_kg: 82.4 },
    { measured_on: '2026-08-25', weight_kg: 81.1 },
    { measured_on: '2026-08-26', weight_kg: null },
  ];

  it('acha o peso do dia da foto', () => {
    const porDia = weightByDay(medidas);
    expect(weightForDay(porDia, '2026-08-25')).toBe(81.1);
  });

  it('foto sem peso próprio pega o peso registrado naquele dia', () => {
    // este é o bug: a foto vinha com null e a tela dizia "sem peso"
    const porDia = weightByDay(medidas);
    expect(weightForDay(porDia, '2026-08-20', null)).toBe(82.4);
  });

  it('a medida do dia vence a cópia guardada na foto', () => {
    // corrigir o peso na tela de Medidas precisa corrigir a foto junto
    const porDia = weightByDay(medidas);
    expect(weightForDay(porDia, '2026-08-25', 99)).toBe(81.1);
  });

  it('sem medida no dia, a cópia da foto ainda serve', () => {
    const porDia = weightByDay(medidas);
    expect(weightForDay(porDia, '2026-07-01', 88.2)).toBe(88.2);
  });

  it('dia sem peso nenhum devolve nulo em vez de zero', () => {
    const porDia = weightByDay(medidas);
    expect(weightForDay(porDia, '2026-08-26')).toBeNull();
    expect(weightForDay(porDia, '2026-01-01')).toBeNull();
  });

  it('medida sem peso não entra no mapa', () => {
    expect(weightByDay(medidas).has('2026-08-26')).toBe(false);
  });

  it('lista vazia não quebra', () => {
    expect(weightByDay([]).size).toBe(0);
  });
});
