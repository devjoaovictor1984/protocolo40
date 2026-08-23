import { describe, expect, it } from 'vitest';

import {
  aguaDiariaMl,
  calcularMetas,
  faixaDoImc,
  fatorDeAtividade,
  idadeEm,
  imcDe,
  objetivoCalorico,
  pesoDeReferencia,
  proteinaPorQuilo,
  taxaMetabolicaBasal,
  type PerfilSaude,
} from '@/services/health';

/**
 * Números que a pessoa vai levar a sério precisam bater com a fórmula, e não
 * apenas "parecer certos". Cada caso aqui confere um valor calculável à mão.
 */

const BASE: PerfilSaude = {
  pesoKg: 80,
  alturaCm: 178,
  idade: 41,
  sexo: 'masculino',
  objetivo: 'perder',
  diasDeTreinoPorSemana: 5,
  minutosDeTreinoHoje: 0,
};

describe('IMC', () => {
  it('calcula peso sobre altura ao quadrado', () => {
    expect(imcDe(80, 178)).toBeCloseTo(25.25, 2);
    expect(imcDe(60, 170)).toBeCloseTo(20.76, 2);
  });

  it('classifica pelas faixas da OMS, incluindo as bordas', () => {
    expect(faixaDoImc(18.4)).toBe('abaixo');
    expect(faixaDoImc(18.5)).toBe('adequado');
    expect(faixaDoImc(24.9)).toBe('adequado');
    expect(faixaDoImc(25)).toBe('sobrepeso');
    expect(faixaDoImc(29.9)).toBe('sobrepeso');
    expect(faixaDoImc(30)).toBe('obesidade');
  });

  it('devolve faixa de peso, e não um número único', () => {
    const faixa = pesoDeReferencia(178);

    expect(faixa.min).toBeCloseTo(58.6, 1);
    expect(faixa.max).toBeCloseTo(78.89, 1);
    // o extremo da faixa cai de volta dentro da classificação adequada
    expect(faixaDoImc(imcDe(faixa.min, 178))).toBe('adequado');
    expect(faixaDoImc(imcDe(faixa.max, 178))).toBe('adequado');
  });
});

describe('gasto energético', () => {
  it('aplica Mifflin-St Jeor com o termo de cada sexo', () => {
    // 10·80 + 6.25·178 − 5·41 = 1707.5
    expect(taxaMetabolicaBasal(80, 178, 41, 'masculino')).toBeCloseTo(1712.5, 1);
    expect(taxaMetabolicaBasal(80, 178, 41, 'feminino')).toBeCloseTo(1546.5, 1);
  });

  it('sem sexo informado usa a média das duas equações', () => {
    const media =
      (taxaMetabolicaBasal(80, 178, 41, 'masculino') +
        taxaMetabolicaBasal(80, 178, 41, 'feminino')) /
      2;

    expect(taxaMetabolicaBasal(80, 178, 41, 'nao_informado')).toBeCloseTo(media, 6);
  });

  it('o fator de atividade sai da frequência real de treino', () => {
    expect(fatorDeAtividade(0)).toBe(1.2);
    expect(fatorDeAtividade(1)).toBe(1.3);
    expect(fatorDeAtividade(3)).toBe(1.375);
    expect(fatorDeAtividade(5)).toBe(1.55);
    expect(fatorDeAtividade(7)).toBe(1.725);
  });
});

describe('metas', () => {
  it('perder gordura vira déficit moderado, nunca agressivo', () => {
    const metas = calcularMetas(BASE);

    expect(metas.gastoDiario).toBe(Math.round(1712.5 * 1.55));
    expect(metas.ajusteCalorico).toBeLessThan(0);

    // o corte fica na faixa de 15% a 20% do gasto
    const proporcao = Math.abs(metas.ajusteCalorico!) / metas.gastoDiario!;
    expect(proporcao).toBeGreaterThan(0.15);
    expect(proporcao).toBeLessThan(0.2);
  });

  it('ganhar massa vira superávit pequeno', () => {
    const metas = calcularMetas({ ...BASE, objetivo: 'ganhar' });

    expect(metas.ajusteCalorico).toBeGreaterThan(0);
    expect(metas.ajusteCalorico! / metas.gastoDiario!).toBeCloseTo(0.1, 2);
  });

  it('manter não mexe nas calorias', () => {
    const metas = calcularMetas({ ...BASE, objetivo: 'manter' });
    expect(metas.ajusteCalorico).toBe(0);
    expect(metas.metaCalorica).toBe(metas.gastoDiario);
  });

  it('a proteína sobe em déficit, porque protege o músculo', () => {
    expect(proteinaPorQuilo('perder')).toBe(2.0);
    expect(proteinaPorQuilo('manter')).toBe(1.6);
    expect(proteinaPorQuilo('ganhar')).toBe(1.8);

    expect(calcularMetas(BASE).proteinaGramas).toBe(160);
    expect(calcularMetas({ ...BASE, objetivo: 'manter' }).proteinaGramas).toBe(128);
  });

  it('a água soma o suor do treino do dia', () => {
    expect(aguaDiariaMl(80, 0)).toBe(2800);
    expect(aguaDiariaMl(80, 60)).toBe(3300);
    expect(aguaDiariaMl(80, 20)).toBe(2950);
  });

  it('diz o que falta para entrar na faixa, e zero quando já está nela', () => {
    const acima = calcularMetas({ ...BASE, pesoKg: 90 });
    expect(acima.faixa).toBe('sobrepeso');
    expect(acima.diferencaParaFaixa).toBeCloseTo(90 - 78.89, 1);

    const dentro = calcularMetas({ ...BASE, pesoKg: 70 });
    expect(dentro.faixa).toBe('adequado');
    expect(dentro.diferencaParaFaixa).toBe(0);

    const abaixo = calcularMetas({ ...BASE, pesoKg: 50 });
    expect(abaixo.faixa).toBe('abaixo');
    expect(abaixo.diferencaParaFaixa).toBeLessThan(0);
  });

  it('sem peso ou altura não inventa número nenhum', () => {
    const semPeso = calcularMetas({ ...BASE, pesoKg: null });

    expect(semPeso.imc).toBeNull();
    expect(semPeso.gastoDiario).toBeNull();
    expect(semPeso.proteinaGramas).toBeNull();
    expect(semPeso.aguaMl).toBeNull();
    // a faixa de peso depende só da altura, e essa continua conhecida
    expect(semPeso.pesoDeReferencia).not.toBeNull();
  });

  it('sem idade não estima gasto, mas o IMC continua valendo', () => {
    const semIdade = calcularMetas({ ...BASE, idade: null });

    expect(semIdade.imc).not.toBeNull();
    expect(semIdade.taxaBasal).toBeNull();
    expect(semIdade.metaCalorica).toBeNull();
  });

  it('marca a estimativa como grosseira quando o sexo não foi informado', () => {
    expect(calcularMetas({ ...BASE, sexo: 'nao_informado' }).estimativaGrosseira).toBe(true);
    expect(calcularMetas(BASE).estimativaGrosseira).toBe(false);
  });

  it('posiciona o marcador da régua entre 0 e 1', () => {
    expect(calcularMetas({ ...BASE, pesoKg: 30 }).posicaoNaRegua).toBe(0);
    expect(calcularMetas({ ...BASE, pesoKg: 200 }).posicaoNaRegua).toBe(1);

    const meio = calcularMetas({ ...BASE, pesoKg: 79 }).posicaoNaRegua!;
    expect(meio).toBeGreaterThan(0);
    expect(meio).toBeLessThan(1);
  });
});

describe('idade e objetivo', () => {
  it('conta anos completos, e o aniversário de hoje já conta', () => {
    expect(idadeEm('1984-08-24', '2026-08-24')).toBe(42);
    expect(idadeEm('1984-08-25', '2026-08-24')).toBe(41);
    expect(idadeEm('1984-12-01', '2026-08-24')).toBe(41);
  });

  it('recusa data malformada em vez de devolver número errado', () => {
    expect(idadeEm('24/08/1984', '2026-08-24')).toBeNull();
    expect(idadeEm('', '2026-08-24')).toBeNull();
  });

  it('traduz o objetivo do perfil para a direção calórica', () => {
    expect(objetivoCalorico('perder_gordura')).toBe('perder');
    expect(objetivoCalorico('melhorar_shape')).toBe('perder');
    expect(objetivoCalorico('ganhar_massa')).toBe('ganhar');
    expect(objetivoCalorico('ganhar_forca')).toBe('ganhar');
    expect(objetivoCalorico('manter_saude')).toBe('manter');
    expect(objetivoCalorico(null)).toBe('manter');
  });
});
