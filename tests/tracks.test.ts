import { describe, expect, it } from 'vitest';

import {
  estadoDaSessao,
  progressoNaTrilha,
  ehDescanso,
  recadoDaTrilha,
  semanasDaTrilha,
  type Sessao,
} from '@/services/tracks';
import type { TrackFocus } from '@/types/database';

/** Uma trilha de teste com o mesmo formato da real: 4 semanas de 7 sessões. */
const SESSOES: Sessao[] = Array.from({ length: 28 }, (_, indice) => {
  const position = indice + 1;
  const focos: TrackFocus[] = [
    'forca',
    'cardio',
    'core',
    'mobilidade',
    'forca',
    'referencia',
    'recuperacao',
  ];

  return {
    position,
    week: Math.ceil(position / 7),
    title: `Sessão ${position}`,
    focus: focos[indice % 7],
    note: 'Uma frase do treinador que tem mais de dez caracteres.',
    templateId: `template-${position}`,
  };
});

const INICIO = '2026-09-01';

/** Dias de setembro a partir dos números. */
const dias = (...numeros: number[]) => numeros.map((n) => `2026-09-${String(n).padStart(2, '0')}`);

describe('em que sessão eu estou', () => {
  it('no dia da matrícula, sem treino, a trilha está na sessão 1', () => {
    const p = progressoNaTrilha(SESSOES, [], INICIO, INICIO);

    expect(p.feitas).toBe(0);
    expect(p.atual?.position).toBe(1);
    expect(p.ultima).toBeNull();
    expect(p.semana).toBe(1);
    expect(p.treinouHoje).toBe(false);
    expect(p.diasDesdeInicio).toBe(1);
    expect(p.diasParado).toBeNull();
  });

  it('a trilha anda com dias treinados, não com o calendário', () => {
    // entrou dia 1 e treinou em três dias espalhados: está na sessão 4, não na 11
    const p = progressoNaTrilha(SESSOES, dias(1, 4, 6), INICIO, '2026-09-11');

    expect(p.feitas).toBe(3);
    expect(p.atual?.position).toBe(4);
    expect(p.diasDesdeInicio).toBe(11);
  });

  it('dois treinos no mesmo dia são um dia só', () => {
    const p = progressoNaTrilha(SESSOES, [...dias(1, 1, 1, 2)], INICIO, '2026-09-02');
    expect(p.feitas).toBe(2);
  });

  it('treino anterior à matrícula não adianta a trilha', () => {
    // quem já treinava não começa na sessão 20
    const p = progressoNaTrilha(
      SESSOES,
      ['2026-08-20', '2026-08-21', '2026-08-30', ...dias(1)],
      INICIO,
      '2026-09-01',
    );

    expect(p.feitas).toBe(1);
  });

  it('dia inválido e dia no futuro não contam', () => {
    const p = progressoNaTrilha(SESSOES, [...dias(1), 'amanhã', '2026-12-25'], INICIO, '2026-09-02');
    expect(p.feitas).toBe(1);
  });

  it('a semana acompanha a sessão atual', () => {
    const setePrimeiros = dias(1, 2, 3, 4, 5, 6, 7);
    expect(progressoNaTrilha(SESSOES, setePrimeiros, INICIO, '2026-09-07').semana).toBe(2);
  });

  it('conta os dias parados desde o último treino', () => {
    const p = progressoNaTrilha(SESSOES, dias(1, 2), INICIO, '2026-09-06');
    expect(p.diasParado).toBe(4);
    expect(p.treinouHoje).toBe(false);
  });

  it('quem treinou hoje tem zero dia parado', () => {
    const p = progressoNaTrilha(SESSOES, dias(1, 2), INICIO, '2026-09-02');
    expect(p.diasParado).toBe(0);
    expect(p.treinouHoje).toBe(true);
  });
});

describe('o fim da trilha', () => {
  const vinteEOito = Array.from({ length: 28 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);

  it('vinte e oito dias fecham as vinte e oito sessões', () => {
    const p = progressoNaTrilha(SESSOES, vinteEOito, INICIO, '2026-09-28');

    expect(p.concluida).toBe(true);
    expect(p.feitas).toBe(28);
    expect(p.atual).toBeNull();
    expect(p.ultima?.position).toBe(28);
    expect(p.fracao).toBe(1);
  });

  it('treinar depois do fim não estoura a contagem', () => {
    const p = progressoNaTrilha(SESSOES, [...vinteEOito, ...dias(29, 30)], INICIO, '2026-09-30');

    expect(p.feitas).toBe(28);
    expect(p.fracao).toBe(1);
  });

  it('trilha sem sessão nenhuma não fica concluída por acidente', () => {
    const p = progressoNaTrilha([], dias(1, 2, 3), INICIO, '2026-09-03');

    expect(p.total).toBe(0);
    expect(p.concluida).toBe(false);
    expect(p.fracao).toBe(0);
    expect(p.atual).toBeNull();
  });
});

describe('estado de cada sessão no mapa', () => {
  it('separa feitas, atual e adiante', () => {
    const p = progressoNaTrilha(SESSOES, dias(1, 2, 3), INICIO, '2026-09-03');

    expect(estadoDaSessao(SESSOES[0], p)).toBe('feita');
    expect(estadoDaSessao(SESSOES[2], p)).toBe('feita');
    expect(estadoDaSessao(SESSOES[3], p)).toBe('atual');
    expect(estadoDaSessao(SESSOES[4], p)).toBe('adiante');
  });

  it('com a trilha completa não sobra sessão atual', () => {
    const todos = Array.from({ length: 28 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const p = progressoNaTrilha(SESSOES, todos, INICIO, '2026-09-28');

    expect(SESSOES.every((sessao) => estadoDaSessao(sessao, p) === 'feita')).toBe(true);
  });
});

describe('agrupamento por semana', () => {
  it('quatro semanas de sete, com os nomes da trilha', () => {
    const semanas = semanasDaTrilha(SESSOES, ['Fundação', 'Ritmo', 'Força', 'Graduação']);

    expect(semanas).toHaveLength(4);
    expect(semanas[0]).toMatchObject({ numero: 1, titulo: 'Fundação' });
    expect(semanas[0].sessoes).toHaveLength(7);
    expect(semanas[3].sessoes.at(-1)?.position).toBe(28);
  });

  it('sem nomes, a semana fica só com o número', () => {
    expect(semanasDaTrilha(SESSOES)[0].titulo).toBeNull();
  });

  it('ordena por posição mesmo recebendo embaralhado', () => {
    const embaralhado = [...SESSOES].reverse();
    expect(semanasDaTrilha(embaralhado)[0].sessoes[0].position).toBe(1);
  });
});

describe('o recado da tela', () => {
  it('no começo, convida sem cobrar', () => {
    const p = progressoNaTrilha(SESSOES, [], INICIO, INICIO);
    expect(recadoDaTrilha(p)).toContain('Dia 1 de 28');
  });

  it('quem treinou hoje ouve que o dia está fechado e qual é a próxima', () => {
    const p = progressoNaTrilha(SESSOES, dias(1, 2), INICIO, '2026-09-02');
    const recado = recadoDaTrilha(p);

    expect(recado).toContain('Dia 2 está feito');
    expect(recado).toContain('dia 3');
  });

  it('depois de uma pausa, reconhece a ausência sem cobrar', () => {
    const p = progressoNaTrilha(SESSOES, dias(1, 2), INICIO, '2026-09-08');
    const recado = recadoDaTrilha(p);

    expect(recado).toContain('6 dias sem treinar');
    expect(recado).toContain('dia 3');
    // nunca cobra: sem "você deveria", sem "atrasado", sem "perdeu"
    expect(recado).not.toMatch(/atras|perde|deveria/i);
  });

  it('dois dias parados ainda não viram assunto', () => {
    const p = progressoNaTrilha(SESSOES, dias(1, 2), INICIO, '2026-09-04');
    expect(recadoDaTrilha(p)).toContain('Dia 3 de 28');
  });

  it('a última sessão é anunciada como última', () => {
    const p = progressoNaTrilha(SESSOES, dias(...Array.from({ length: 27 }, (_, i) => i + 1)), INICIO, '2026-09-28');
    expect(recadoDaTrilha(p)).toContain('É o último');
  });

  it('no fim, fecha o arco e devolve a biblioteca', () => {
    const todos = Array.from({ length: 28 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const p = progressoNaTrilha(SESSOES, todos, INICIO, '2026-09-28');

    expect(recadoDaTrilha(p)).toContain('Trilha completa');
  });

  it('nenhum recado fala de corpo', () => {
    const cenarios = [
      progressoNaTrilha(SESSOES, [], INICIO, INICIO),
      progressoNaTrilha(SESSOES, dias(1, 2), INICIO, '2026-09-02'),
      progressoNaTrilha(SESSOES, dias(1, 2), INICIO, '2026-09-10'),
    ];

    for (const cenario of cenarios) {
      expect(recadoDaTrilha(cenario)).not.toMatch(/peso|kg|gordura|magr|barriga|dieta/i);
    }
  });
});

describe('o dia de descanso da trilha', () => {
  // a trilha do novato: seis de treino, um de descanso
  const COM_DESCANSO: Sessao[] = Array.from({ length: 14 }, (_, indice) => {
    const position = indice + 1;
    const descanso = position % 7 === 0;
    return {
      position,
      week: Math.ceil(position / 7),
      title: descanso ? 'Descanso' : `Treino ${position}`,
      focus: descanso ? 'descanso' : 'forca',
      note: 'nota da sessão',
      templateId: descanso ? null : `template-${position}`,
    };
  });

  it('depois de seis dias, o sétimo é descanso — e a tela diz como cumpri-lo', () => {
    const p = progressoNaTrilha(COM_DESCANSO, dias(1, 2, 3, 4, 5, 6), INICIO, '2026-09-07');
    expect(p.atual && ehDescanso(p.atual)).toBe(true);
    expect(recadoDaTrilha(p)).toMatch(/Dia 7 de 14 é descanso/);
    expect(recadoDaTrilha(p)).toMatch(/treine, se preferir: também conta/);
  });

  it('o descanso registrado conta como dia cumprido', () => {
    // a lista de dias vem do banco com treinos e descansos juntos
    const p = progressoNaTrilha(COM_DESCANSO, dias(1, 2, 3, 4, 5, 6, 7), INICIO, '2026-09-07');
    expect(p.feitas).toBe(7);
    expect(p.atual?.position).toBe(8);
  });

  it('com o sexto dia feito, avisa que o próximo é descanso', () => {
    const p = progressoNaTrilha(COM_DESCANSO, dias(1, 2, 3, 4, 5, 6), INICIO, '2026-09-06');
    expect(recadoDaTrilha(p)).toMatch(/próximo é descanso/);
  });
});
