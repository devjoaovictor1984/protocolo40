import { describe, expect, it } from 'vitest';

import {
  restartSession,
  addMinutes,
  displaySeconds,
  elapsedSeconds,
  finishSession,
  formatClock,
  formatDurationShort,
  isPaused,
  pause,
  progressRatio,
  remainingSeconds,
  resume,
  startSession,
  toggleMode,
} from '@/services/duration';

const T0 = new Date('2026-08-22T10:00:00.000Z').getTime();
const minutes = (n: number) => n * 60_000;

describe('cronômetro', () => {
  it('começa em 20:00 no modo regressivo', () => {
    const session = startSession(T0);
    expect(displaySeconds(session, T0)).toBe(1200);
    expect(formatClock(displaySeconds(session, T0))).toBe('20:00');
  });

  it('calcula o tempo pelo relógio, não por contador', () => {
    // É isto que faz o cronômetro sobreviver a segundo plano e tela bloqueada:
    // nenhum tick precisou acontecer entre T0 e T0 + 5 minutos.
    const session = startSession(T0);
    expect(elapsedSeconds(session, T0 + minutes(5))).toBe(300);
    expect(remainingSeconds(session, T0 + minutes(5))).toBe(900);
  });

  it('desconta o tempo pausado', () => {
    let session = startSession(T0);
    session = pause(session, T0 + minutes(5));
    session = resume(session, T0 + minutes(8));

    expect(isPaused(session)).toBe(false);
    expect(elapsedSeconds(session, T0 + minutes(10))).toBe(minutes(7) / 1000);
  });

  it('congela o tempo enquanto está pausado', () => {
    let session = startSession(T0);
    session = pause(session, T0 + minutes(5));

    expect(isPaused(session)).toBe(true);
    expect(elapsedSeconds(session, T0 + minutes(9))).toBe(300);
    expect(elapsedSeconds(session, T0 + minutes(30))).toBe(300);
  });

  it('soma várias pausas', () => {
    let session = startSession(T0);
    session = pause(session, T0 + minutes(2));
    session = resume(session, T0 + minutes(4));
    session = pause(session, T0 + minutes(6));
    session = resume(session, T0 + minutes(9));

    expect(elapsedSeconds(session, T0 + minutes(10))).toBe(minutes(5) / 1000);
  });

  it('pausar duas vezes seguidas não abre duas pausas', () => {
    let session = startSession(T0);
    session = pause(session, T0 + minutes(1));
    session = pause(session, T0 + minutes(2));
    expect(session.pauses).toHaveLength(1);
  });

  it('não deixa o regressivo ficar negativo', () => {
    const session = startSession(T0);
    expect(remainingSeconds(session, T0 + minutes(35))).toBe(0);
  });

  it('o progressivo continua contando depois da meta', () => {
    const session = toggleMode(startSession(T0));
    expect(session.mode).toBe('progressivo');
    expect(displaySeconds(session, T0 + minutes(35))).toBe(2100);
    expect(formatClock(2100)).toBe('35:00');
  });

  it('adicionar tempo mexe na meta, não no tempo treinado', () => {
    const session = addMinutes(startSession(T0), 5);
    expect(session.targetSeconds).toBe(1500);
    expect(elapsedSeconds(session, T0 + minutes(5))).toBe(300);
    expect(remainingSeconds(session, T0 + minutes(5))).toBe(1200);
  });

  it('o anel de progresso satura em 100%', () => {
    const session = startSession(T0);
    expect(progressRatio(session, T0 + minutes(10))).toBeCloseTo(0.5);
    expect(progressRatio(session, T0 + minutes(40))).toBe(1);
  });

  it('finalizar com pausa aberta não conta o tempo parado', () => {
    let session = startSession(T0);
    session = pause(session, T0 + minutes(12));

    const result = finishSession(session, T0 + minutes(20));
    expect(result.durationSeconds).toBe(720);
    expect(result.startedAt).toBe('2026-08-22T10:00:00.000Z');
    expect(result.finishedAt).toBe('2026-08-22T10:20:00.000Z');
  });

  it('aceita treino curto: 10 minutos valem tanto quanto 20', () => {
    const result = finishSession(startSession(T0), T0 + minutes(10));
    expect(result.durationSeconds).toBe(600);
  });
});

describe('formatação', () => {
  it('mostra mm:ss abaixo de uma hora', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(59)).toBe('00:59');
    expect(formatClock(1200)).toBe('20:00');
  });

  it('mostra h:mm:ss a partir de uma hora', () => {
    expect(formatClock(3930)).toBe('1:05:30');
  });

  it('nunca mostra tempo negativo', () => {
    expect(formatClock(-10)).toBe('00:00');
  });

  it('resume a duração para listas', () => {
    expect(formatDurationShort(1200)).toBe('20 min');
    expect(formatDurationShort(3600)).toBe('1h');
    expect(formatDurationShort(3900)).toBe('1h 05');
  });
});

describe('duração nunca sai zerada', () => {
  it('finalizar no mesmo instante grava 1 segundo, não 0', () => {
    // o banco recusa duration_seconds = 0 e o registro ficaria preso na fila
    const result = finishSession(startSession(T0), T0);
    expect(result.durationSeconds).toBe(1);
  });

  it('finalizar com o cronômetro pausado desde o começo também grava 1', () => {
    const session = pause(startSession(T0), T0);
    expect(finishSession(session, T0 + minutes(5)).durationSeconds).toBe(1);
  });

  it('acima do piso a duração é a real', () => {
    expect(finishSession(startSession(T0), T0 + minutes(3)).durationSeconds).toBe(180);
  });
});

/**
 * Recomeçar o relógio sem desistir do treino.
 *
 * O caso que originou: esquecer o cronômetro rodando, voltar quinze minutos
 * depois e ver um número que não corresponde a esforço nenhum. Apagar tudo e
 * montar de novo é caro demais para um engano tão comum.
 */
describe('recomeçar', () => {
  const base = {
    startedAt: 1_000_000,
    pauses: [{ at: 1_100_000, until: 1_200_000 }],
    targetSeconds: 1200,
    mode: 'regressivo' as const,
  };

  it('zera o tempo decorrido', () => {
    const agora = 2_000_000;
    expect(elapsedSeconds(base, agora)).toBeGreaterThan(0);
    expect(elapsedSeconds(restartSession(base, agora), agora)).toBe(0);
  });

  it('esquece as pausas', () => {
    expect(restartSession(base, 2_000_000).pauses).toEqual([]);
  });

  it('mantém a meta e o modo — recomeçar o tempo não é desistir do treino', () => {
    const novo = restartSession(base, 2_000_000);
    expect(novo.targetSeconds).toBe(base.targetSeconds);
    expect(novo.mode).toBe(base.mode);
  });

  it('não altera a sessão recebida', () => {
    restartSession(base, 2_000_000);
    expect(base.startedAt).toBe(1_000_000);
    expect(base.pauses).toHaveLength(1);
  });

  it('depois de recomeçar, o cronômetro não está pausado', () => {
    const pausada = { ...base, pauses: [{ at: 1_500_000, until: null }] };
    expect(isPaused(restartSession(pausada, 2_000_000))).toBe(false);
  });
});
