import { describe, expect, it } from 'vitest';

import {
  AVISO_ANTES,
  PRESETS,
  duracaoDoCiclo,
  linhaDoTempo,
  momentoEm,
  sinalEm,
  type ConfiguracaoDeIntervalo,
} from '@/services/intervals';

const UM_MINUTO: ConfiguracaoDeIntervalo = { trabalho: 60, descanso: 60 };
const TABATA: ConfiguracaoDeIntervalo = { trabalho: 20, descanso: 10 };
const SINO: ConfiguracaoDeIntervalo = { trabalho: 60, descanso: 0 };

describe('em que fase estou', () => {
  it('o treino começa trabalhando', () => {
    expect(momentoEm(UM_MINUTO, 0)).toEqual({ fase: 'trabalho', restante: 60, ciclo: 1 });
  });

  it('vira para o descanso quando o esforço acaba', () => {
    expect(momentoEm(UM_MINUTO, 59).fase).toBe('trabalho');
    expect(momentoEm(UM_MINUTO, 60).fase).toBe('descanso');
    expect(momentoEm(UM_MINUTO, 119).fase).toBe('descanso');
  });

  it('a segunda volta recomeça o esforço', () => {
    expect(momentoEm(UM_MINUTO, 120)).toEqual({ fase: 'trabalho', restante: 60, ciclo: 2 });
  });

  it('conta quanto falta para virar', () => {
    expect(momentoEm(TABATA, 17).restante).toBe(3);
    expect(momentoEm(TABATA, 25).restante).toBe(5);
  });

  it('sem descanso, nunca sai do trabalho', () => {
    for (const s of [0, 59, 60, 61, 600]) {
      expect(momentoEm(SINO, s).fase, `segundo ${s}`).toBe('trabalho');
    }
  });

  it('configuração inválida não quebra a tela', () => {
    expect(momentoEm({ trabalho: 0, descanso: 0 }, 10).fase).toBe('trabalho');
    expect(momentoEm({ trabalho: NaN, descanso: 10 }, 10).ciclo).toBe(1);
    expect(momentoEm(UM_MINUTO, -5).ciclo).toBe(1);
  });
});

/**
 * O som é o produto aqui: a pessoa está de olhos fechados fazendo corrida
 * estacionária. Se o sinal errado tocar, ela para quando devia acelerar.
 */
describe('o que soa em cada segundo', () => {
  it('o treino abre com o sinal de começar', () => {
    expect(sinalEm(UM_MINUTO, 0)).toBe('comecar');
  });

  it('avisa três segundos antes de cada virada', () => {
    expect(sinalEm(UM_MINUTO, 57)).toBe('contagem');
    expect(sinalEm(UM_MINUTO, 58)).toBe('contagem');
    expect(sinalEm(UM_MINUTO, 59)).toBe('contagem');
  });

  it('e marca a virada em si com som próprio', () => {
    expect(sinalEm(UM_MINUTO, 60)).toBe('parar');
    expect(sinalEm(UM_MINUTO, 120)).toBe('comecar');
  });

  it('fica em silêncio no meio da fase', () => {
    for (const s of [1, 10, 30, 45, 70, 90]) {
      expect(sinalEm(UM_MINUTO, s), `segundo ${s}`).toBeNull();
    }
  });

  it('sem descanso, toca só a passagem de cada minuto', () => {
    expect(sinalEm(SINO, 0)).toBe('comecar');
    expect(sinalEm(SINO, 60)).toBe('comecar');
    expect(sinalEm(SINO, 120)).toBe('comecar');
    // e não existe "parar", porque não há pausa marcada
    const sinais = linhaDoTempo(SINO, 180).map((s) => s.sinal);
    expect(sinais).not.toContain('parar');
  });

  /**
   * Avisar três segundos antes de uma pausa de dois seria som contínuo — o
   * aviso perderia a função de aviso.
   */
  it('não avisa quando a fase é mais curta que o aviso', () => {
    const curto: ConfiguracaoDeIntervalo = { trabalho: 10, descanso: 2 };
    const sinais = linhaDoTempo(curto, 24);

    expect(sinais.filter((s) => s.sinal === 'contagem').every((s) => s.segundo % 12 < 10)).toBe(
      true,
    );
  });

  it('o aviso cabe numa fase que o comporta', () => {
    expect(sinalEm(TABATA, 27)).toBe('contagem');
    expect(sinalEm(TABATA, 28)).toBe('contagem');
    expect(sinalEm(TABATA, 29)).toBe('contagem');
    expect(sinalEm(TABATA, 30)).toBe('comecar');
  });
});

describe('a linha do tempo, que a demonstração usa', () => {
  it('desenha um ciclo inteiro de tabata', () => {
    const linha = linhaDoTempo(TABATA, 30);

    expect(linha).toEqual([
      { segundo: 0, sinal: 'comecar' },
      { segundo: 17, sinal: 'contagem' },
      { segundo: 18, sinal: 'contagem' },
      { segundo: 19, sinal: 'contagem' },
      { segundo: 20, sinal: 'parar' },
      { segundo: 27, sinal: 'contagem' },
      { segundo: 28, sinal: 'contagem' },
      { segundo: 29, sinal: 'contagem' },
      { segundo: 30, sinal: 'comecar' },
    ]);
  });

  it('não inventa sinal antes do começo', () => {
    expect(linhaDoTempo(TABATA, -1)).toEqual([]);
  });
});

describe('presets', () => {
  it('todos são configurações válidas', () => {
    for (const preset of PRESETS) {
      expect(preset.config.trabalho, preset.nome).toBeGreaterThan(0);
      expect(preset.config.descanso, preset.nome).toBeGreaterThanOrEqual(0);
      expect(duracaoDoCiclo(preset.config), preset.nome).toBeGreaterThan(0);
    }
  });

  it('cada um soa de algum jeito no primeiro minuto', () => {
    for (const preset of PRESETS) {
      expect(linhaDoTempo(preset.config, 60).length, preset.nome).toBeGreaterThan(0);
    }
  });

  it('o aviso é o mesmo em todos', () => {
    expect(AVISO_ANTES).toBe(3);
  });
});
