import { describe, expect, it } from 'vitest';

import {
  analisarMeta,
  avaliarAlvo,
  marcosDe,
  mediaNaJanela,
  pisoDoAlvo,
  ritmoSeguroSemanal,
  tendenciaEm,
  type MetaDePeso,
  type PesoRegistrado,
} from '@/services/goals';

/**
 * O que estes testes protegem:
 *
 * 1. O progresso não pode reagir à balança do dia. É a diferença entre um app
 *    que a pessoa acredita e um que ela aprende a ignorar.
 * 2. A previsão nunca pode sair de um ritmo insustentável — se sair, o app está
 *    prometendo o resultado de uma dieta agressiva.
 * 3. O piso de segurança tem que valer, e o aviso tem que parar onde começa o
 *    palpite sobre o corpo dos outros.
 */

const meta: MetaDePeso = {
  alvoKg: 72,
  inicioKg: 80,
  inicioEm: '2026-01-05',
  alcancadaEm: null,
};

/** Peso caindo de forma constante, um registro por dia. */
function serie(deDia: string, dias: number, inicio: number, porDia: number): PesoRegistrado[] {
  const [ano, mes, diaBase] = deDia.split('-').map(Number);
  const base = Date.UTC(ano, mes - 1, diaBase);

  return Array.from({ length: dias }, (_, indice) => {
    const data = new Date(base + indice * 86_400_000);
    return {
      measured_on: data.toISOString().slice(0, 10),
      weight_kg: Math.round((inicio + porDia * indice) * 100) / 100,
    };
  });
}

describe('média na janela', () => {
  const pesos: PesoRegistrado[] = [
    { measured_on: '2026-03-01', weight_kg: 80 },
    { measured_on: '2026-03-05', weight_kg: 78 },
    { measured_on: '2026-03-07', weight_kg: 79 },
    // sem peso não entra na conta, mesmo estando na janela
    { measured_on: '2026-03-06', weight_kg: null },
  ];

  it('soma só o que está dentro do intervalo', () => {
    expect(mediaNaJanela(pesos, '2026-03-07', 7)).toBeCloseTo((80 + 78 + 79) / 3, 5);
    // três dias terminando em 07: entram 05 e 07, não o 01
    expect(mediaNaJanela(pesos, '2026-03-07', 3)).toBeCloseTo(78.5, 5);
  });

  it('devolve nulo quando não há registro na janela', () => {
    expect(mediaNaJanela(pesos, '2026-04-01', 7)).toBeNull();
  });
});

describe('tendência', () => {
  it('usa sete dias quando há registro recente', () => {
    const pesos = serie('2026-03-01', 10, 80, -0.1);
    const resultado = tendenciaEm(pesos, '2026-03-10');

    expect(resultado?.janelaDias).toBe(7);
  });

  it('abre a janela até 21 dias antes de desistir', () => {
    const pesos: PesoRegistrado[] = [{ measured_on: '2026-03-01', weight_kg: 80 }];

    expect(tendenciaEm(pesos, '2026-03-15')?.janelaDias).toBe(21);
    expect(tendenciaEm(pesos, '2026-04-15')).toBeNull();
  });

  /** O caso que motivou a tendência existir. */
  it('não se deixa levar por uma pesagem fora da curva', () => {
    const estavel: PesoRegistrado[] = [
      { measured_on: '2026-03-04', weight_kg: 80 },
      { measured_on: '2026-03-05', weight_kg: 80 },
      { measured_on: '2026-03-06', weight_kg: 80 },
      { measured_on: '2026-03-07', weight_kg: 80 },
      // dia de sal: quase dois quilos de água a mais
      { measured_on: '2026-03-08', weight_kg: 81.8 },
    ];

    const tendencia = tendenciaEm(estavel, '2026-03-08');

    expect(tendencia?.kg).toBeLessThan(80.4);
    expect(tendencia?.kg).toBeGreaterThan(80.2);
  });
});

describe('ritmo seguro', () => {
  it('perde a 0,5% e ganha a 0,25% do peso por semana', () => {
    expect(ritmoSeguroSemanal(80, 'perder')).toBeCloseTo(0.4, 5);
    expect(ritmoSeguroSemanal(80, 'ganhar')).toBeCloseTo(0.2, 5);
    expect(ritmoSeguroSemanal(60, 'perder')).toBeCloseTo(0.3, 5);
  });
});

describe('marcos', () => {
  it('divide o caminho em degraus de cerca de 1% do peso de partida', () => {
    const marcos = marcosDe(80, 72);

    expect(marcos.at(-1)).toMatchObject({ pesoKg: 72, final: true });
    // 1% de 80 é 0,8, arredondado para o meio quilo mais próximo: degrau de 1 kg
    expect(marcos[0].pesoKg).toBeCloseTo(79, 5);
    expect(marcos.length).toBeGreaterThan(4);
  });

  it('arredonda o degrau para baixo quando 1% fica perto de meio quilo', () => {
    // 1% de 60 é 0,6 → degrau de 0,5 kg
    expect(marcosDe(60, 55)[0].pesoKg).toBeCloseTo(59.5, 5);
  });

  it('sobe quando a meta é ganhar peso', () => {
    const marcos = marcosDe(60, 66);

    expect(marcos[0].pesoKg).toBeGreaterThan(60);
    expect(marcos.at(-1)?.pesoKg).toBe(66);
  });

  it('não devolve degrau nenhum quando o alvo está colado no início', () => {
    expect(marcosDe(80, 79.8)).toEqual([]);
  });

  it('nunca passa de doze degraus, mesmo numa meta longa', () => {
    expect(marcosDe(140, 80).length).toBeLessThanOrEqual(13);
  });
});

describe('piso de segurança do alvo', () => {
  it('recusa o que fica abaixo de IMC 17', () => {
    // 1,75 m · IMC 17 = 52,1 kg
    expect(pisoDoAlvo(175)).toBeCloseTo(52.1, 1);
    expect(avaliarAlvo(48, 175).nivel).toBe('recusado');
  });

  it('avisa, sem recusar, entre IMC 17 e 18,5', () => {
    // 1,75 m · IMC 18 = 55,1 kg
    expect(avaliarAlvo(55, 175).nivel).toBe('aviso');
  });

  it('não opina sobre alvo dentro da faixa de referência', () => {
    expect(avaliarAlvo(70, 175).nivel).toBe('ok');
  });

  it('sem altura no perfil não há piso a aplicar', () => {
    expect(avaliarAlvo(40, null).nivel).toBe('ok');
  });
});

describe('progresso da meta', () => {
  it('mede o percorrido pela tendência, e não pela última pesagem', () => {
    // 80 kg caindo 0,05 kg/dia por 40 dias: termina perto de 78
    const pesos = serie('2026-01-05', 40, 80, -0.05);
    // e uma pesagem de dia ruim no fim, que não pode dominar a conta
    pesos.push({ measured_on: '2026-02-13', weight_kg: 79.9 });

    const progresso = analisarMeta(meta, pesos, '2026-02-13');

    expect(progresso.direcao).toBe('perder');
    expect(progresso.tendenciaKg).toBeLessThan(78.6);
    expect(progresso.percorridoKg).toBeGreaterThan(1);
    expect(progresso.restanteKg).toBeLessThan(7);
  });

  it('sem pesagem recente, não inventa progresso', () => {
    const progresso = analisarMeta(meta, [], '2026-02-13');

    expect(progresso.situacao).toBe('sem_dados');
    expect(progresso.tendenciaKg).toBeNull();
    expect(progresso.fracao).toBe(0);
    expect(progresso.previsaoEm).toBeNull();
  });

  it('andar para o lado errado não vira progresso negativo', () => {
    const pesos = serie('2026-01-05', 40, 80, 0.05);
    const progresso = analisarMeta(meta, pesos, '2026-02-13');

    expect(progresso.percorridoKg).toBe(0);
    expect(progresso.fracao).toBe(0);
    expect(progresso.situacao).toBe('afastando');
  });

  it('chama de platô o peso que não anda há semanas', () => {
    const pesos = serie('2026-01-05', 45, 78, 0);
    const progresso = analisarMeta(meta, pesos, '2026-02-18');

    expect(progresso.situacao).toBe('parada');
    // e o texto não culpa ninguém
    expect(progresso.leitura.texto).toContain('fase normal');
  });

  /**
   * O teste que impede a promessa perigosa: quem está perdendo 1,2 kg por
   * semana não pode ver "você chega em seis semanas", porque essa data só se
   * cumpre mantendo um ritmo que custa massa magra.
   */
  it('a previsão usa o ritmo de referência quando o real passa dele', () => {
    const pesos = serie('2026-01-05', 40, 80, -0.17);
    const progresso = analisarMeta(meta, pesos, '2026-02-13');

    expect(progresso.situacao).toBe('rapido_demais');
    expect(progresso.ritmoSemanal ?? 0).toBeGreaterThan(1);

    const semanasNoRitmoReal = progresso.restanteKg / (progresso.ritmoSemanal ?? 1);
    expect(progresso.semanasRestantes ?? 0).toBeGreaterThan(semanasNoRitmoReal);
  });

  it('reconhece a chegada pela tendência', () => {
    const pesos = serie('2026-02-01', 14, 71.8, 0);
    const progresso = analisarMeta(meta, pesos, '2026-02-14');

    expect(progresso.situacao).toBe('alcancada');
    expect(progresso.fracao).toBe(1);
    expect(progresso.marcos.every((marco) => marco.atingido)).toBe(true);
  });

  it('não mede ritmo contra um período anterior à própria meta', () => {
    // pesagens começam bem antes; a meta nasceu ontem
    const pesos = serie('2026-01-01', 60, 82, -0.05);
    const recente: MetaDePeso = { ...meta, inicioEm: '2026-02-27' };
    const progresso = analisarMeta(recente, pesos, '2026-03-01');

    expect(progresso.ritmoSemanal).toBeNull();
    expect(progresso.situacao).toBe('poucos_dados');
  });
});
