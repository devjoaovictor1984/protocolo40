import { describe, expect, it } from 'vitest';

import { analisar, type TreinoFeito } from '@/services/analysis';

/**
 * A consultoria precisa acertar o diagnóstico, não só produzir texto.
 *
 * Cada caso aqui monta um histórico com uma característica clara e verifica que
 * a recomendação correspondente aparece — e, tão importante quanto, que as
 * outras não aparecem quando não deveriam.
 */

const HOJE = '2026-08-24'; // segunda-feira

function barra(reps: number, sets: number | null = 3) {
  return {
    exercise_id: 'ex-barra',
    exercise_name: 'Barra fixa',
    category: 'costas',
    sets,
    repetitions: reps,
    duration_seconds: null,
    distance_meters: null,
    weight_kg: null,
  };
}

function flexao(reps: number, sets: number | null = 3) {
  return {
    exercise_id: 'ex-flexao',
    exercise_name: 'Flexão',
    category: 'peito',
    sets,
    repetitions: reps,
    duration_seconds: null,
    distance_meters: null,
    weight_kg: null,
  };
}

function treino(data: string, effort: number | null, exercises: TreinoFeito['exercises']): TreinoFeito {
  return { workout_date: data, duration_seconds: 1200, rounds: null, effort, exercises };
}

/** Dias recuados a partir de `HOJE`, no formato do banco. */
function diaAtras(dias: number): string {
  const base = Date.UTC(2026, 7, 24) - dias * 86_400_000;
  return new Date(base).toISOString().slice(0, 10);
}

describe('análise', () => {
  it('sem treino nenhum não inventa diagnóstico', () => {
    const analise = analisar([], HOJE);

    expect(analise.treinos).toBe(0);
    expect(analise.exercicios).toEqual([]);
    expect(analise.gerais).toEqual([]);
  });

  it('conta sessões, volume e esforço médio por exercício', () => {
    const analise = analisar(
      [
        treino(diaAtras(1), 8, [barra(5), flexao(10)]),
        treino(diaAtras(3), 6, [barra(5)]),
      ],
      HOJE,
    );

    const barraFixa = analise.exercicios.find((item) => item.exerciseId === 'ex-barra')!;

    expect(barraFixa.sessoes).toBe(2);
    expect(barraFixa.volume).toBe(30); // 3 séries × 5 reps × 2 sessões
    expect(barraFixa.seriesPorSemana).toBeCloseTo(1.5); // 6 séries em 4 semanas
    expect(barraFixa.esforcoMedio).toBe(7);
    expect(analise.esforcoMedio).toBe(7);
    expect(analise.comEsforco).toBe(2);
  });

  it('esforço alto sem o volume crescer vira alerta de platô', () => {
    const historico = [
      // janela anterior: volume maior
      ...[30, 32, 34, 36].map((dias) => treino(diaAtras(dias), 8, [barra(8)])),
      // janela recente: mesmo esforço, volume menor
      ...[2, 5, 9, 12].map((dias) => treino(diaAtras(dias), 9, [barra(4)])),
    ];

    const analise = analisar(historico, HOJE);
    const barraFixa = analise.exercicios.find((item) => item.exerciseId === 'ex-barra')!;
    const ids = barraFixa.recomendacoes.map((item) => item.id);

    expect(ids).toContain('ex-barra-plato');
    expect(barraFixa.recomendacoes.find((r) => r.id === 'ex-barra-plato')?.severidade).toBe(
      'atencao',
    );
  });

  it('barra em esforço alto e volume baixo recebe o plano de negativas', () => {
    const analise = analisar(
      [2, 5, 9].map((dias) => treino(diaAtras(dias), 9, [barra(3, 2)])),
      HOJE,
    );

    const barraFixa = analise.exercicios.find((item) => item.exerciseId === 'ex-barra')!;
    const plano = barraFixa.recomendacoes.find((item) => item.id === 'ex-barra-barra');

    expect(plano).toBeDefined();
    expect(plano!.acao).toContain('negativas');
    expect(plano!.porque).toContain('excêntrica');
  });

  it('esforço baixo e constante vira "está confortável demais"', () => {
    const analise = analisar(
      [2, 5, 9, 12].map((dias) => treino(diaAtras(dias), 4, [flexao(10)])),
      HOJE,
    );

    const push = analise.exercicios.find((item) => item.exerciseId === 'ex-flexao')!;
    expect(push.recomendacoes.map((item) => item.id)).toContain('ex-flexao-leve');
  });

  it('volume semanal abaixo de dez séries aponta falta de volume', () => {
    const analise = analisar([treino(diaAtras(2), 7, [barra(5, 2)])], HOJE);

    const barraFixa = analise.exercicios.find((item) => item.exerciseId === 'ex-barra')!;
    expect(barraFixa.recomendacoes.map((item) => item.id)).toContain('ex-barra-volume');
  });

  it('volume alto com esforço alto aponta dívida de recuperação', () => {
    const analise = analisar(
      [1, 3, 5, 7, 9, 11, 13, 15].map((dias) => treino(diaAtras(dias), 9, [barra(6, 12)])),
      HOJE,
    );

    const barraFixa = analise.exercicios.find((item) => item.exerciseId === 'ex-barra')!;
    expect(barraFixa.recomendacoes.map((item) => item.id)).toContain('ex-barra-excesso');
  });

  it('dias seguidos no mesmo movimento em alta intensidade viram aviso', () => {
    const analise = analisar(
      [2, 3, 4].map((dias) => treino(diaAtras(dias), 9, [barra(6, 4)])),
      HOJE,
    );

    const barraFixa = analise.exercicios.find((item) => item.exerciseId === 'ex-barra')!;
    expect(barraFixa.recomendacoes.map((item) => item.id)).toContain('ex-barra-descanso');
  });

  it('progresso com esforço sustentável é elogiado, e nada é mandado mudar', () => {
    const historico = [
      ...[30, 33, 36].map((dias) => treino(diaAtras(dias), 7, [barra(5, 4)])),
      ...[2, 5, 9, 12].map((dias) => treino(diaAtras(dias), 7, [barra(8, 4)])),
    ];

    const analise = analisar(historico, HOJE);
    const barraFixa = analise.exercicios.find((item) => item.exerciseId === 'ex-barra')!;

    expect(barraFixa.recomendacoes.map((item) => item.id)).toContain('ex-barra-bom');
    expect(barraFixa.recomendacoes.map((item) => item.id)).not.toContain('ex-barra-plato');
  });

  it('sem esforço declarado, a primeira orientação é declarar o esforço', () => {
    const analise = analisar(
      [2, 5, 9].map((dias) => treino(diaAtras(dias), null, [barra(6)])),
      HOJE,
    );

    expect(analise.gerais.map((item) => item.id)).toContain('geral-sem-esforco');
    expect(analise.esforcoMedio).toBeNull();
  });

  it('esforço máximo todos os dias pede um dia leve', () => {
    const analise = analisar(
      [1, 3, 5, 7, 9, 11].map((dias) => treino(diaAtras(dias), 10, [barra(6), flexao(10)])),
      HOJE,
    );

    expect(analise.gerais.map((item) => item.id)).toContain('geral-sempre-no-limite');
  });

  it('treinos fora da janela de quatro semanas não entram na conta', () => {
    const analise = analisar([treino(diaAtras(90), 9, [barra(10)])], HOJE);

    expect(analise.treinos).toBe(0);
    expect(analise.exercicios).toEqual([]);
  });

  it('AMRAP sem séries usa os rounds como número de execuções', () => {
    const analise = analisar(
      [
        {
          workout_date: diaAtras(2),
          duration_seconds: 1200,
          rounds: 6,
          effort: 8,
          exercises: [barra(5, null)],
        },
      ],
      HOJE,
    );

    const barraFixa = analise.exercicios.find((item) => item.exerciseId === 'ex-barra')!;
    expect(barraFixa.volume).toBe(30); // 6 rounds × 5 repetições
    expect(barraFixa.seriesPorSemana).toBeCloseTo(1.5);
  });

  it('o que tem alerta aparece antes do que está bem', () => {
    const historico = [
      ...[30, 33].map((dias) => treino(diaAtras(dias), 8, [barra(10, 4)])),
      ...[2, 5, 9].map((dias) => treino(diaAtras(dias), 9, [barra(2, 4), flexao(12, 4)])),
    ];

    const analise = analisar(historico, HOJE);
    expect(analise.exercicios[0].exerciseId).toBe('ex-barra');
  });
});
