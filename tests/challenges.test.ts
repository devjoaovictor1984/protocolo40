import { describe, expect, it } from 'vitest';

import {
  desafioEmDestaque,
  desafiosDoHoje,
  diasMarcaveis,
  emSemanas,
  erroDaMarcacao,
  linhaDoTempo,
  diasComOAparelho,
  diasDoDesafio,
  faseDo,
  posicoes,
  progressoNoDesafio,
  recadoDoDesafio,
  esbocoDoMes,
  diasNoMes,
  MESES,
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

/**
 * O esboço mensal existe para tirar da mão seis campos que dependem uns dos
 * outros. Se ele errar, o erro vai para o ar e só aparece depois que alguém já
 * entrou no desafio — daí estes testes.
 */
describe('esboço de desafio mensal', () => {
  it('monta o mês inteiro, do primeiro ao último dia', () => {
    const outubro = esbocoDoMes(2026, 10);

    expect(outubro).toMatchObject({
      slug: 'outubro-2026',
      title: 'Desafio de Outubro',
      starts_on: '2026-10-01',
      ends_on: '2026-10-31',
      badge_slug: 'outubro',
    });
  });

  it('acerta fevereiro, inclusive bissexto', () => {
    expect(esbocoDoMes(2026, 2)?.ends_on).toBe('2026-02-28');
    expect(esbocoDoMes(2028, 2)?.ends_on).toBe('2028-02-29');
    expect(diasNoMes(2100, 2)).toBe(28);
  });

  it('deixa cinco dias de folga na meta', () => {
    // 31 dias menos 5 é 26; 30 menos 5 é 25, a mesma conta do Desafio de Setembro
    expect(esbocoDoMes(2026, 1)?.goal).toBe(26);
    expect(esbocoDoMes(2026, 9)?.goal).toBe(25);
    expect(esbocoDoMes(2026, 2)?.goal).toBe(23);
  });

  it('gera endereço que passa na constraint do banco', () => {
    for (const mes of MESES) {
      const esboco = esbocoDoMes(2027, mes.numero);
      expect(esboco).not.toBeNull();
      // challenge_slug_forma: ^[a-z0-9-]{3,40}$ — março não pode virar "março"
      expect(esboco!.slug).toMatch(/^[a-z0-9-]{3,40}$/);
    }

    expect(esbocoDoMes(2027, 3)?.slug).toBe('marco-2027');
  });

  it('a insígnia é do mês e não do ano: repetir março não dá insígnia nova', () => {
    expect(esbocoDoMes(2026, 3)?.badge_slug).toBe('marco');
    expect(esbocoDoMes(2027, 3)?.badge_slug).toBe('marco');
  });

  it('recusa mês e ano fora do mundo real', () => {
    expect(esbocoDoMes(2026, 0)).toBeNull();
    expect(esbocoDoMes(2026, 13)).toBeNull();
    expect(esbocoDoMes(1800, 5)).toBeNull();
    expect(esbocoDoMes(2026.5, 5)).toBeNull();
  });
});

/**
 * A correção do aparelho.
 *
 * O cartão do desafio é renderizado no servidor, e a contagem sai dos treinos
 * que já subiram. Sem isto, quem terminava o treino sem rede via o painel dizer
 * "treino de hoje feito" e o cartão do desafio dizer "hoje ainda está em
 * aberto", lado a lado na mesma tela.
 */
describe('os dias do desafio corrigidos pelo aparelho', () => {
  const vazio = { feitos: [], apagados: [] };

  it('sem nada guardado, devolve o que veio do servidor', () => {
    expect(diasComOAparelho(dias(1, 2), vazio)).toEqual(dias(1, 2));
  });

  it('o treino que ainda não subiu entra', () => {
    expect(diasComOAparelho(dias(1, 2), { feitos: dias(3), apagados: [] })).toEqual(dias(1, 2, 3));
  });

  it('não duplica o dia que já está nos dois lados', () => {
    expect(diasComOAparelho(dias(1, 2), { feitos: dias(2), apagados: [] })).toEqual(dias(1, 2));
  });

  it('o treino apagado aqui sai, mesmo que o servidor ainda o conte', () => {
    expect(diasComOAparelho(dias(1, 2), { feitos: dias(1), apagados: dias(2) })).toEqual(dias(1));
  });

  it('apagar um de dois treinos do mesmo dia não tira o dia', () => {
    // dois treinos num dia contam como um; enquanto sobrar um, o dia fica
    expect(diasComOAparelho(dias(1), { feitos: dias(1), apagados: dias(1) })).toEqual(dias(1));
  });

  it('o resultado sai em ordem, para a grade do mês não embaralhar', () => {
    expect(diasComOAparelho(dias(5, 1), { feitos: dias(3), apagados: [] })).toEqual(dias(1, 3, 5));
  });

  it('o progresso passa a contar o treino que não subiu', () => {
    const doServidor = dias(1, 2);
    const comOAparelho = diasComOAparelho(doServidor, { feitos: dias(3), apagados: [] });

    expect(progressoNoDesafio(SETEMBRO, doServidor, '2026-09-03').hoje).toBe(false);
    expect(progressoNoDesafio(SETEMBRO, comOAparelho, '2026-09-03').hoje).toBe(true);
    expect(progressoNoDesafio(SETEMBRO, comOAparelho, '2026-09-03').cumpridos).toBe(3);
  });
});

/**
 * A tela de Hoje passou a mostrar o próximo desafio assim que ele é criado. O
 * de outubro ficava invisível até o dia 1º — justamente quando as pessoas já
 * deveriam estar dentro.
 */
describe('os desafios da tela de Hoje', () => {
  type D = {
    slug: string;
    starts_on: string;
    ends_on: string;
    kind: 'treino' | 'alimentacao';
    sort_order?: number;
    participando?: boolean;
  };
  const d = (slug: string, starts_on: string, ends_on: string, extra: Partial<D> = {}): D => ({
    slug,
    starts_on,
    ends_on,
    kind: 'treino',
    ...extra,
  });
  const slugs = (lista: { desafio: D }[]) => lista.map((item) => item.desafio.slug);

  it('com setembro em curso, outubro já aparece como convite', () => {
    const lista = desafiosDoHoje(
      [d('outubro', '2026-10-01', '2026-10-31'), d('setembro', '2026-09-01', '2026-09-30')],
      '2026-09-27',
    );

    expect(lista).toEqual([
      { desafio: expect.objectContaining({ slug: 'setembro' }), papel: 'em_curso' },
      { desafio: expect.objectContaining({ slug: 'outubro' }), papel: 'convite' },
    ]);
  });

  it('treino e alimentação não disputam o mesmo lugar', () => {
    const lista = desafiosDoHoje(
      [
        d('novembro', '2026-11-01', '2026-11-30'),
        d('acucar', '2026-11-03', '2026-11-23', { kind: 'alimentacao' }),
      ],
      '2026-11-10',
    );

    expect(slugs(lista).sort()).toEqual(['acucar', 'novembro']);
  });

  it('em curso vem antes de convite', () => {
    const lista = desafiosDoHoje(
      [
        d('dezembro', '2026-12-01', '2026-12-31'),
        d('acucar', '2026-11-03', '2026-11-23', { kind: 'alimentacao' }),
      ],
      '2026-11-10',
    );

    expect(lista.map((item) => item.papel)).toEqual(['em_curso', 'convite']);
    expect(slugs(lista)).toEqual(['acucar', 'dezembro']);
  });

  it('só o próximo de cada tipo é convidado, não a fila inteira', () => {
    const lista = desafiosDoHoje(
      [d('novembro', '2026-11-01', '2026-11-30'), d('outubro', '2026-10-01', '2026-10-31')],
      '2026-09-27',
    );

    expect(slugs(lista)).toEqual(['outubro']);
  });

  it('entre dois em curso do mesmo tipo, ganha aquele em que a pessoa está', () => {
    const lista = desafiosDoHoje(
      [
        d('vitrine', '2026-09-01', '2026-09-30', { sort_order: 50 }),
        d('meu', '2026-09-01', '2026-09-30', { participando: true }),
      ],
      '2026-09-15',
    );

    expect(slugs(lista)).toEqual(['meu']);
  });

  it('encerrado nunca aparece', () => {
    expect(desafiosDoHoje([d('agosto', '2026-08-01', '2026-08-31')], '2026-09-15')).toEqual([]);
  });
});

describe('desafio de marcação', () => {
  const ACUCAR = { starts_on: '2026-11-03', ends_on: '2026-11-23', goal: 18 };

  it('dá para marcar hoje e ontem, e nada além', () => {
    expect(diasMarcaveis(ACUCAR, '2026-11-10')).toEqual(['2026-11-10', '2026-11-09']);
  });

  it('no primeiro dia, ontem é antes do desafio e não aparece', () => {
    expect(diasMarcaveis(ACUCAR, '2026-11-03')).toEqual(['2026-11-03']);
  });

  it('no dia seguinte ao fim, ainda dá para marcar o último dia', () => {
    // quem venceu o dia 21 e dormiu sem marcar não perde o fechamento
    expect(diasMarcaveis(ACUCAR, '2026-11-24')).toEqual(['2026-11-23']);
  });

  it('antes de começar, não há o que marcar', () => {
    expect(diasMarcaveis(ACUCAR, '2026-10-30')).toEqual([]);
  });

  it('a linha do tempo tem 21 pontos, contados do Dia 1', () => {
    const linha = linhaDoTempo(ACUCAR, [], '2026-11-03');
    expect(linha).toHaveLength(21);
    expect(linha[0]).toMatchObject({ dia: '2026-11-03', numero: 1, hoje: true });
    expect(linha[20]).toMatchObject({ dia: '2026-11-23', numero: 21, estado: 'futuro' });
  });

  it('cada dia sabe o próprio estado', () => {
    const linha = linhaDoTempo(ACUCAR, ['2026-11-03', '2026-11-05'], '2026-11-07');
    const estado = (dia: string) => linha.find((ponto) => ponto.dia === dia)?.estado;

    expect(estado('2026-11-03')).toBe('vencido');
    expect(estado('2026-11-04')).toBe('passou');
    expect(estado('2026-11-05')).toBe('vencido');
    expect(estado('2026-11-06')).toBe('em_aberto'); // ontem ainda dá
    expect(estado('2026-11-07')).toBe('em_aberto'); // hoje
    expect(estado('2026-11-08')).toBe('futuro');
  });

  it('um dia sem marca não zera os anteriores', () => {
    const vencidos = ['2026-11-03', '2026-11-04', '2026-11-06'];
    expect(progressoNoDesafio(ACUCAR, vencidos, '2026-11-07').cumpridos).toBe(3);
  });

  it('em semanas de sete, três fileiras', () => {
    expect(emSemanas(linhaDoTempo(ACUCAR, [], '2026-11-03')).map((s) => s.length)).toEqual([7, 7, 7]);
  });

  it('o recado de comida nunca diz que hoje não pode faltar', () => {
    // 21 dias, meta 18, dia 4 com só o primeiro vencido: folga zero
    const progresso = progressoNoDesafio(ACUCAR, ['2026-11-03'], '2026-11-06');
    expect(progresso.folga).toBe(0);
    const frase = recadoDoDesafio(progresso, 18, 'alimentacao');

    expect(frase).not.toMatch(/não pode faltar/);
    expect(frase).toMatch(/em aberto/);
  });

  it('quem venceu o dia lê "Dia vencido"', () => {
    const progresso = progressoNoDesafio(ACUCAR, ['2026-11-03'], '2026-11-03');
    expect(recadoDoDesafio(progresso, 18, 'alimentacao')).toMatch(/^Dia vencido\./);
  });

  it('cada recusa do banco vira uma frase que explica', () => {
    expect(erroDaMarcacao('ok')).toBeNull();
    expect(erroDaMarcacao('fora_do_prazo')).toMatch(/hoje e ontem/);
    expect(erroDaMarcacao('nao_participa')).toMatch(/Entre nele/);
    expect(erroDaMarcacao('qualquer-coisa')).toMatch(/tente de novo/);
  });
});
