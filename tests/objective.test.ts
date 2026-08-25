import { describe, expect, it } from 'vitest';

import type { TreinoFeito } from '@/services/analysis';
import { focoDaSemana, type Objetivo } from '@/services/objective';

/**
 * O mesmo mês de treinos precisa gerar conselhos diferentes para objetivos
 * diferentes. É essa a razão do módulo existir: quem quer perder gordura e quem
 * quer ganhar força fizeram a mesma semana e precisam ouvir coisas opostas.
 */

const HOJE = '2026-09-28'; // segunda-feira
/** A janela de quatro semanas vai de 07/09 a 28/09; a anterior, de 10/08 a 06/09. */
const JANELA = '2026-09-07';
const ANTERIOR = '2026-08-10';

/** Um treino simples num dia, com esforço declarado. */
const treino = (dia: string, esforco: number | null = 7, reps = 30): TreinoFeito => ({
  workout_date: dia,
  duration_seconds: 1200,
  effort: esforco,
  rounds: 3,
  exercises: [
    {
      exercise_id: 'flexao',
      exercise_name: 'Flexão',
      category: 'peito',
      sets: 3,
      repetitions: reps,
      duration_seconds: null,
      distance_meters: null,
      weight_kg: null,
    },
  ],
});

/** Dias de treino dentro da janela de quatro semanas que termina em HOJE. */
function diasNaJanela(quantidade: number, inicio = '2026-09-01'): string[] {
  const dias: string[] = [];
  const base = new Date(`${inicio}T00:00:00Z`).getTime();

  for (let i = 0; i < quantidade; i += 1) {
    dias.push(new Date(base + i * 86_400_000).toISOString().slice(0, 10));
  }

  return dias;
}

const foco = (
  dias: string[],
  objetivo: Objetivo | null,
  opcoes: { esforco?: number | null; descansos?: string[]; reps?: number } = {},
) =>
  focoDaSemana(
    dias.map((dia) => treino(dia, opcoes.esforco === undefined ? 7 : opcoes.esforco, opcoes.reps ?? 30)),
    opcoes.descansos ?? [],
    objetivo,
    HOJE,
  );

const tem = (resultado: ReturnType<typeof foco>, chave: string) =>
  resultado.pontos.some((ponto) => ponto.chave === chave);

describe('o foco muda com o objetivo', () => {
  const doisDias = diasNaJanela(2, '2026-09-07').concat(diasNaJanela(2, '2026-09-14'));

  it('quatro dias por semana bastam para força, mas não para perder gordura', () => {
    const quatroPorSemana = [
      ...diasNaJanela(4, '2026-09-07'),
      ...diasNaJanela(4, '2026-09-14'),
      ...diasNaJanela(4, '2026-09-21'),
      ...diasNaJanela(4, '2026-09-28'),
    ];

    expect(tem(foco(quatroPorSemana, 'ganhar_forca', { esforco: 8 }), 'frequencia-ok')).toBe(true);
    expect(tem(foco(quatroPorSemana, 'perder_gordura'), 'frequencia-baixa')).toBe(true);
  });

  it('esforço 5 é pouco para força e está de bom tamanho para disciplina', () => {
    const dias = diasNaJanela(16, JANELA);

    expect(tem(foco(dias, 'ganhar_forca', { esforco: 5 }), 'esforco-baixo')).toBe(true);
    expect(tem(foco(dias, 'criar_disciplina', { esforco: 5 }), 'esforco-baixo')).toBe(false);
  });

  it('esforço 9 é o alvo da força e é demais para manter a saúde', () => {
    const dias = diasNaJanela(12, JANELA);

    expect(tem(foco(dias, 'ganhar_forca', { esforco: 9 }), 'esforco-alto')).toBe(false);
    expect(tem(foco(dias, 'manter_saude', { esforco: 9 }), 'esforco-alto')).toBe(true);
  });

  it('sem objetivo declarado, ainda analisa — só sem personalizar', () => {
    const resultado = foco(doisDias, null);
    expect(resultado.objetivo).toBe('outro');
    expect(resultado.nome).toBe('seu objetivo');
  });
});

describe('descanso', () => {
  it('quem nunca descansa ouve sobre recuperação, se o objetivo pedir', () => {
    const todosOsDias = diasNaJanela(20, JANELA);
    expect(tem(foco(todosOsDias, 'ganhar_forca', { esforco: 8 }), 'descanso-curto')).toBe(true);
  });

  it('quem quer disciplina não é cobrado por descansar pouco', () => {
    const todosOsDias = diasNaJanela(20, '2026-09-01');
    expect(tem(foco(todosOsDias, 'criar_disciplina', { esforco: 5 }), 'descanso-curto')).toBe(false);
  });

  it('descanso registrado conta como recuperação, e não como falha', () => {
    const dias = diasNaJanela(3, '2026-09-07')
      .concat(diasNaJanela(3, '2026-09-14'))
      .concat(diasNaJanela(3, '2026-09-21'))
      .concat(diasNaJanela(3, '2026-09-28'));

    const descansos = ['2026-09-10', '2026-09-17', '2026-09-24', '2026-09-27'];

    const semRegistrar = foco(dias, 'ganhar_forca', { esforco: 8 });
    const registrando = foco(dias, 'ganhar_forca', { esforco: 8, descansos });

    expect(registrando.descansoPorSemana).toBeGreaterThan(semRegistrar.descansoPorSemana);
  });

  /**
   * A média esconde o caso perigoso: dez dias emendados e quatro parados dão a
   * mesma média de uma semana equilibrada, e não são a mesma coisa para o corpo.
   */
  it('vê a emenda longa mesmo quando a média de descanso parece boa', () => {
    const emendados = diasNaJanela(12, JANELA);
    const resultado = foco(emendados, 'ganhar_massa', { esforco: 8 });

    expect(resultado.maiorEmenda).toBe(12);
    expect(tem(resultado, 'emenda-longa')).toBe(true);
  });

  it('emenda curta não vira alerta', () => {
    const dias = [
      ...diasNaJanela(3, '2026-09-07'),
      ...diasNaJanela(3, '2026-09-14'),
      ...diasNaJanela(3, '2026-09-21'),
      ...diasNaJanela(3, '2026-09-28'),
    ];

    expect(foco(dias, 'ganhar_massa').maiorEmenda).toBe(3);
    expect(tem(foco(dias, 'ganhar_massa'), 'emenda-longa')).toBe(false);
  });
});

describe('quantidade', () => {
  it('volume parado há um mês vira o ponto principal', () => {
    // mesmas repetições nos dois meses
    const janela = [
      ...diasNaJanela(3, '2026-09-07'),
      ...diasNaJanela(3, '2026-09-14'),
      ...diasNaJanela(3, '2026-09-21'),
      ...diasNaJanela(3, '2026-09-28'),
    ];
    const anterior = [
      ...diasNaJanela(3, '2026-08-10'),
      ...diasNaJanela(3, '2026-08-17'),
      ...diasNaJanela(3, '2026-08-24'),
      ...diasNaJanela(3, '2026-08-31'),
    ];

    const treinos = [...anterior, ...janela].map((dia) => treino(dia, 7, 30));
    const resultado = focoDaSemana(treinos, [], 'ganhar_massa', HOJE);

    expect(resultado.variacaoDeVolume).toBe(0);
    expect(resultado.pontos.some((p) => p.chave === 'volume-parado')).toBe(true);
  });

  it('volume subindo é reconhecido', () => {
    const anterior = diasNaJanela(12, ANTERIOR).map((dia) => treino(dia, 7, 20));
    const agora = diasNaJanela(12, JANELA).map((dia) => treino(dia, 7, 30));

    const resultado = focoDaSemana([...anterior, ...agora], [], 'ganhar_massa', HOJE);

    expect(resultado.variacaoDeVolume).toBeGreaterThan(0.1);
    expect(resultado.pontos.some((p) => p.chave === 'volume-subindo')).toBe(true);
  });

  it('volume caindo é dito sem drama', () => {
    const anterior = diasNaJanela(12, ANTERIOR).map((dia) => treino(dia, 7, 40));
    const agora = diasNaJanela(12, JANELA).map((dia) => treino(dia, 7, 20));

    const resultado = focoDaSemana([...anterior, ...agora], [], 'ganhar_massa', HOJE);
    const ponto = resultado.pontos.find((p) => p.chave === 'volume-caindo');

    expect(ponto).toBeTruthy();
    expect(ponto!.severidade).not.toBe('atencao');
    expect(ponto!.detalhe).toMatch(/tudo bem/i);
  });

  it('sem mês anterior, não inventa comparação', () => {
    expect(foco(diasNaJanela(12, JANELA), 'ganhar_massa').variacaoDeVolume).toBeNull();
  });
});

describe('honestidade', () => {
  it('com menos de três treinos, admite que não dá para analisar', () => {
    const resultado = foco(['2026-09-20', '2026-09-22'], 'perder_gordura');

    expect(resultado.pontos).toHaveLength(1);
    expect(resultado.pontos[0].chave).toBe('sem-base');
    expect(resultado.pontos[0].detalhe).toMatch(/chute/);
  });

  it('sem treino nenhum não quebra', () => {
    const resultado = focoDaSemana([], [], 'perder_gordura', HOJE);

    expect(resultado.diasPorSemana).toBe(0);
    expect(resultado.maiorEmenda).toBe(0);
    expect(resultado.pontos[0].chave).toBe('sem-base');
  });

  it('sem esforço declarado, pede a nota em vez de adivinhar', () => {
    const resultado = foco(diasNaJanela(12, JANELA), 'ganhar_forca', { esforco: null });

    expect(resultado.esforcoMedio).toBeNull();
    expect(tem(resultado, 'sem-esforco')).toBe(true);
    expect(tem(resultado, 'esforco-baixo')).toBe(false);
    expect(tem(resultado, 'esforco-alto')).toBe(false);
  });

  it('nunca cobra nem culpa, em nenhum objetivo', () => {
    const objetivos: Objetivo[] = [
      'perder_gordura',
      'ganhar_forca',
      'condicionamento',
      'ganhar_massa',
      'melhorar_shape',
      'criar_disciplina',
      'manter_saude',
      'outro',
    ];

    const proibidos = /preguiç|vergonha|desistiu|fracass|você falhou|culpa/i;

    for (const objetivo of objetivos) {
      for (const dias of [2, 6, 20]) {
        for (const esforco of [3, 7, 10, null]) {
          const resultado = foco(diasNaJanela(dias, JANELA), objetivo, { esforco });

          for (const ponto of resultado.pontos) {
            expect(`${ponto.titulo} ${ponto.detalhe}`, `${objetivo}/${dias}/${esforco}`).not.toMatch(
              proibidos,
            );
          }
        }
      }
    }
  });

  it('nunca fala de peso — a análise de treino não é a de corpo', () => {
    const corpo = /\bkg\b|seu peso|emagrec|balança/i;

    for (const dias of [4, 12, 20]) {
      const resultado = foco(diasNaJanela(dias, JANELA), 'perder_gordura');

      for (const ponto of resultado.pontos) {
        expect(`${ponto.titulo} ${ponto.detalhe}`).not.toMatch(corpo);
      }
    }
  });
});
