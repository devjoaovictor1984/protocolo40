import { describe, expect, it } from 'vitest';

import {
  BOM,
  campoCsv,
  COLUNAS_MEDIDAS,
  COLUNAS_TREINOS,
  ehTipoValido,
  linhasDeTreino,
  nomeDoArquivo,
  paraCsv,
  type TreinoExportado,
} from '@/services/export';

/**
 * Um CSV quebrado só aparece na planilha de quem baixou — nunca num log nosso.
 * É o tipo de erro que precisa morrer aqui.
 */

describe('escape de campo', () => {
  it('deixa em paz o que não precisa de aspas', () => {
    expect(campoCsv('Flexão')).toBe('Flexão');
    expect(campoCsv(42)).toBe('42');
  });

  it('usa vírgula no decimal, para o Excel em português somar a coluna', () => {
    expect(campoCsv(72.5)).toBe('72,5');
  });

  it('protege o separador dentro do texto — senão a linha inteira desalinha', () => {
    expect(campoCsv('Treino puxado; parei antes')).toBe('"Treino puxado; parei antes"');
  });

  it('dobra as aspas de dentro, como manda o formato', () => {
    expect(campoCsv('Fiz o "AMRAP" inteiro')).toBe('"Fiz o ""AMRAP"" inteiro"');
  });

  it('protege quebra de linha na observação', () => {
    expect(campoCsv('linha um\nlinha dois')).toBe('"linha um\nlinha dois"');
  });

  it('vazio para nulo e indefinido, nunca a palavra null', () => {
    expect(campoCsv(null)).toBe('');
    expect(campoCsv(undefined)).toBe('');
  });
});

describe('planilha', () => {
  it('começa com BOM, senão o Excel estraga os acentos', () => {
    const csv = paraCsv(COLUNAS_MEDIDAS, []);

    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain('Peso (kg)');
  });

  it('escreve uma linha por registro, com quebra CRLF', () => {
    const csv = paraCsv(COLUNAS_MEDIDAS, [
      {
        measured_on: '2026-03-01',
        weight_kg: 78.4,
        waist_cm: null,
        chest_cm: null,
        arm_cm: null,
        hip_cm: null,
        thigh_cm: null,
        body_fat_pct: null,
        notes: null,
      },
    ]);

    const linhas = csv.trimEnd().split('\r\n');
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toBe('2026-03-01;78,4;;;;;;;');
  });
});

describe('treinos em formato longo', () => {
  const treino: TreinoExportado = {
    workout_date: '2026-03-01',
    title: 'Peito e costas',
    duration_seconds: 1200,
    rounds: 4,
    effort: 8,
    location: 'casa',
    notes: 'Boa',
    exercicios: [
      {
        nome: 'Flexão',
        sets: 4,
        repetitions: 15,
        duration_seconds: null,
        distance_meters: null,
        weight_kg: null,
        notes: null,
      },
      {
        nome: 'Barra fixa',
        sets: 4,
        repetitions: 6,
        duration_seconds: null,
        distance_meters: null,
        weight_kg: null,
        notes: 'Negativas',
      },
    ],
  };

  it('repete os dados do treino em cada exercício', () => {
    const linhas = linhasDeTreino([treino]);

    expect(linhas).toHaveLength(2);
    expect(linhas.every((linha) => linha.esforco === 8 && linha.minutos === 20)).toBe(true);
    expect(linhas.map((linha) => linha.exercicio)).toEqual(['Flexão', 'Barra fixa']);
  });

  it('treino sem exercício registrado ainda vira uma linha — ele aconteceu', () => {
    const linhas = linhasDeTreino([{ ...treino, exercicios: [] }]);

    expect(linhas).toHaveLength(1);
    expect(linhas[0].exercicio).toBeNull();
    expect(linhas[0].minutos).toBe(20);
  });

  it('a observação do exercício tem precedência sobre a do treino', () => {
    const linhas = linhasDeTreino([treino]);

    expect(linhas[0].observacoes).toBe('Boa');
    expect(linhas[1].observacoes).toBe('Negativas');
  });

  it('sai com o cabeçalho em português', () => {
    const csv = paraCsv(COLUNAS_TREINOS, linhasDeTreino([treino]));

    expect(csv).toContain('Esforço (1-10)');
    expect(csv).toContain('Carga (kg)');
  });
});

describe('nome do arquivo', () => {
  it('leva assunto, pessoa e data', () => {
    expect(nomeDoArquivo('medidas', 'joao_v', '2026-03-01', 'csv')).toBe(
      'p20x-medidas-joao_v-2026-03-01.csv',
    );
  });

  /**
   * `profiles_username_format` já só aceita `[a-z0-9_]`, então isto é defesa de
   * quem chamar a função com outra coisa — nome de arquivo com barra viraria
   * caminho, e é o que não pode acontecer.
   */
  it('limpa o que não serve em nome de arquivo', () => {
    expect(nomeDoArquivo('tudo', 'joão/vitor', '2026-03-01', 'json')).toBe(
      'p20x-tudo-joovitor-2026-03-01.json',
    );
  });

  it('não deixa o nome vazio quando não sobra nada', () => {
    expect(nomeDoArquivo('agua', '...', '2026-03-01', 'csv')).toBe(
      'p20x-agua-p20x-2026-03-01.csv',
    );
  });
});

describe('tipos aceitos', () => {
  it('reconhece os cinco e recusa o resto', () => {
    expect(ehTipoValido('treinos')).toBe(true);
    expect(ehTipoValido('tudo')).toBe(true);
    expect(ehTipoValido('fotos')).toBe(false);
    expect(ehTipoValido('../../etc/passwd')).toBe(false);
  });
});
