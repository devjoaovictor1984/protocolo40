import { describe, expect, it } from 'vitest';

import {
  desafioEmDestaque,
  diasDoDesafio,
  faseDo,
  posicoes,
  progressoNoDesafio,
  recadoDoDesafio,
} from '@/services/challenges';

const SETEMBRO = { starts_on: '2026-09-01', ends_on: '2026-09-30', goal: 25 };

/** Gera dias treinados a partir do dia 1 de setembro. */
const dias = (...numeros: number[]) =>
  numeros.map((n) => `2026-09-${String(n).padStart(2, '0')}`);

describe('a janela do desafio', () => {
  it('setembro tem trinta dias', () => {
    const janela = diasDoDesafio(SETEMBRO);
    expect(janela).toHaveLength(30);
    expect(janela[0]).toBe('2026-09-01');
    expect(janela.at(-1)).toBe('2026-09-30');
  });

  it('um desafio de um dia só é válido', () => {
    expect(diasDoDesafio({ starts_on: '2026-09-01', ends_on: '2026-09-01' })).toEqual([
      '2026-09-01',
    ]);
  });

  it('data inválida não quebra a tela', () => {
    expect(diasDoDesafio({ starts_on: 'amanhã', ends_on: '2026-09-30' })).toEqual([]);
  });

  it('sabe se ainda não começou, se está rolando ou se acabou', () => {
    expect(faseDo(SETEMBRO, '2026-08-25')).toBe('antes');
    expect(faseDo(SETEMBRO, '2026-09-01')).toBe('durante');
    expect(faseDo(SETEMBRO, '2026-09-30')).toBe('durante');
    expect(faseDo(SETEMBRO, '2026-10-01')).toBe('depois');
  });
});

describe('progresso', () => {
  it('antes de começar, tudo zerado e nada cobrado', () => {
    const p = progressoNoDesafio(SETEMBRO, [], '2026-08-25');
    expect(p).toMatchObject({ fase: 'antes', cumpridos: 0, decorridos: 0, folga: 5 });
  });

  it('conta só os dias dentro da janela', () => {
    // treinou em agosto e em outubro: nada disso entra no desafio de setembro
    const p = progressoNoDesafio(
      SETEMBRO,
      ['2026-08-30', '2026-08-31', ...dias(1, 2), '2026-10-01'],
      '2026-09-02',
    );
    expect(p.cumpridos).toBe(2);
  });

  it('dia repetido conta uma vez — dois treinos no mesmo dia não valem dois dias', () => {
    const p = progressoNoDesafio(SETEMBRO, ['2026-09-01', '2026-09-01'], '2026-09-01');
    expect(p.cumpridos).toBe(1);
  });

  it('a folga encolhe a cada dia perdido', () => {
    // dia 10, treinou 8: perdeu 2 dos 5 que podia
    const p = progressoNoDesafio(SETEMBRO, dias(1, 2, 3, 4, 5, 6, 7, 8), '2026-09-10');
    expect(p.cumpridos).toBe(8);
    expect(p.faltam).toBe(17);
    expect(p.decorridos).toBe(10);
    // sobram 20 dias e faltam 17: três de folga
    expect(p.folga).toBe(3);
    expect(p.alcancavel).toBe(true);
  });

  it('quando a meta não sai mais, diz isso em vez de fingir', () => {
    // dia 29, só 3 treinados: restam 2 dias e faltam 22
    const p = progressoNoDesafio(SETEMBRO, dias(1, 2, 3), '2026-09-29');
    expect(p.alcancavel).toBe(false);
    expect(p.folga).toBeLessThan(0);
  });

  it('bateu a meta antes do fim', () => {
    const p = progressoNoDesafio(
      SETEMBRO,
      dias(...Array.from({ length: 25 }, (_, i) => i + 1)),
      '2026-09-25',
    );
    expect(p.concluido).toBe(true);
    expect(p.faltam).toBe(0);
    expect(p.fracao).toBe(1);
  });

  it('a barra nunca passa de cheia, mesmo treinando os trinta', () => {
    const p = progressoNoDesafio(
      SETEMBRO,
      dias(...Array.from({ length: 30 }, (_, i) => i + 1)),
      '2026-09-30',
    );
    expect(p.fracao).toBe(1);
    expect(p.cumpridos).toBe(30);
  });

  it('sabe se o dia de hoje já está garantido', () => {
    expect(progressoNoDesafio(SETEMBRO, dias(1, 2), '2026-09-02').hoje).toBe(true);
    expect(progressoNoDesafio(SETEMBRO, dias(1), '2026-09-02').hoje).toBe(false);
  });

  it('meta maior que a janela não pede o impossível', () => {
    const curto = { starts_on: '2026-09-01', ends_on: '2026-09-03', goal: 10 };
    const p = progressoNoDesafio(curto, dias(1, 2, 3), '2026-09-03');
    expect(p.concluido).toBe(true);
  });
});

/**
 * O tom importa tanto quanto o número. O app não cobra, não usa culpa e não
 * mente dizendo que dá tempo quando não dá — por isso a frase é regra testada,
 * e não texto solto dentro de um componente.
 */
describe('o recado da tela', () => {
  const recado = (diasTreinados: number[], hoje: string) =>
    recadoDoDesafio(progressoNoDesafio(SETEMBRO, dias(...diasTreinados), hoje), 25);

  it('antes de começar, convida', () => {
    expect(recadoDoDesafio(progressoNoDesafio(SETEMBRO, [], '2026-08-25'), 25)).toMatch(
      /Começa em breve/,
    );
  });

  it('sem folga, avisa que hoje não pode faltar', () => {
    // dia 6, treinou 1: perdeu 5 de 5
    expect(recado([1], '2026-09-06')).toMatch(/Hoje não pode faltar/);
  });

  it('com o dia feito, confirma sem empolgação falsa', () => {
    expect(recado([1, 2, 3], '2026-09-03')).toMatch(/Dia garantido/);
  });

  it('quando não dá mais, não cobra — e lembra do que continua valendo', () => {
    const frase = recado([1, 2, 3], '2026-09-29');
    expect(frase).toMatch(/não sai mais/);
    expect(frase).toMatch(/sequência|insígnias/);
  });

  it('terminado sem bater, não trata como fracasso', () => {
    const frase = recadoDoDesafio(progressoNoDesafio(SETEMBRO, dias(1, 2), '2026-10-05'), 25);
    expect(frase).toMatch(/isso não some/);
  });
});

describe('ranking', () => {
  it('ordena por dias e empata junto', () => {
    const lista = posicoes([
      { user_id: 'a', dias: 9 },
      { user_id: 'b', dias: 12 },
      { user_id: 'c', dias: 12 },
      { user_id: 'd', dias: 3 },
    ]);

    expect(lista.map((l) => [l.user_id, l.posicao])).toEqual([
      ['b', 1],
      ['c', 1],
      // dois empatados no primeiro: o próximo é o terceiro, não o segundo
      ['a', 3],
      ['d', 4],
    ]);
  });

  it('lista vazia não quebra', () => {
    expect(posicoes([])).toEqual([]);
  });

  it('não altera a lista recebida', () => {
    const original = [{ dias: 1 }, { dias: 5 }];
    posicoes(original);
    expect(original[0].dias).toBe(1);
  });
});

/**
 * Qual desafio vai para a tela de Hoje.
 *
 * Estava no repositório, misturado com a consulta, e o cartão pedia os dias com
 * o slug escrito à mão — funcionava enquanto existisse um desafio só. É regra de
 * produto que troca de dono num dia em que ninguém está olhando (o destaque de
 * setembro vira o de outubro à meia-noite), então mora aqui e tem teste.
 */
describe('o desafio em destaque', () => {
  const d = (slug: string, starts_on: string, ends_on: string, sort_order = 0) => ({
    slug,
    starts_on,
    ends_on,
    sort_order,
  });

  it('sem desafio nenhum, não há destaque', () => {
    expect(desafioEmDestaque([], '2026-09-15')).toBeNull();
  });

  it('o que está em curso ganha do que vai começar', () => {
    const escolhido = desafioEmDestaque(
      [d('outubro', '2026-10-01', '2026-10-31'), d('setembro', '2026-09-01', '2026-09-30')],
      '2026-09-15',
    );

    expect(escolhido?.slug).toBe('setembro');
  });

  it('encerrado nunca aparece', () => {
    // ocupar a tela inicial com um desafio que acabou não convida a nada
    expect(desafioEmDestaque([d('agosto', '2026-08-01', '2026-08-31')], '2026-09-15')).toBeNull();
  });

  it('sem nenhum em curso, mostra o próximo a começar', () => {
    const escolhido = desafioEmDestaque(
      [d('novembro', '2026-11-01', '2026-11-30'), d('outubro', '2026-10-01', '2026-10-31')],
      '2026-09-15',
    );

    expect(escolhido?.slug).toBe('outubro');
  });

  it('entre dois em curso, o admin decide pela ordem', () => {
    const escolhido = desafioEmDestaque(
      [
        d('comum', '2026-09-01', '2026-09-30', 0),
        d('vitrine', '2026-09-05', '2026-09-25', 50),
      ],
      '2026-09-15',
    );

    expect(escolhido?.slug).toBe('vitrine');
  });

  it('empatados na ordem, vence o que começou por último', () => {
    const escolhido = desafioEmDestaque(
      [d('antigo', '2026-09-01', '2026-09-30'), d('novo', '2026-09-10', '2026-09-30')],
      '2026-09-15',
    );

    expect(escolhido?.slug).toBe('novo');
  });

  it('o primeiro e o último dia contam como em curso', () => {
    const janela = [d('setembro', '2026-09-01', '2026-09-30')];

    expect(desafioEmDestaque(janela, '2026-09-01')?.slug).toBe('setembro');
    expect(desafioEmDestaque(janela, '2026-09-30')?.slug).toBe('setembro');
    expect(desafioEmDestaque(janela, '2026-10-01')).toBeNull();
  });

  it('não altera a lista recebida', () => {
    const lista = [d('a', '2026-09-01', '2026-09-30', 1), d('b', '2026-09-01', '2026-09-30', 9)];
    desafioEmDestaque(lista, '2026-09-15');
    expect(lista[0].slug).toBe('a');
  });
});
