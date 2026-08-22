import { describe, expect, it } from 'vitest';

import {
  calculateStreak,
  milestoneReached,
  nextMilestone,
  protocolDay,
} from '@/services/streak';

describe('calculateStreak', () => {
  it('devolve zeros quando não há treino', () => {
    expect(calculateStreak([], '2026-08-22')).toEqual({
      current: 0,
      longest: 0,
      totalDays: 0,
      lastDay: null,
    });
  });

  it('conta dias consecutivos até hoje', () => {
    const days = ['2026-08-20', '2026-08-21', '2026-08-22'];
    expect(calculateStreak(days, '2026-08-22')).toMatchObject({
      current: 3,
      longest: 3,
      totalDays: 3,
    });
  });

  it('mantém a sequência viva quando o último treino foi ontem', () => {
    // O usuário ainda não treinou hoje. A sequência não pode zerar às 00:01.
    const days = ['2026-08-20', '2026-08-21'];
    expect(calculateStreak(days, '2026-08-22').current).toBe(2);
  });

  it('zera a sequência atual quando há mais de um dia de intervalo', () => {
    const days = ['2026-08-18', '2026-08-19'];
    const result = calculateStreak(days, '2026-08-22');
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
  });

  it('preserva a maior sequência mesmo depois de uma interrupção', () => {
    const days = [
      '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05',
      '2026-08-21', '2026-08-22',
    ];
    expect(calculateStreak(days, '2026-08-22')).toMatchObject({ current: 2, longest: 5, totalDays: 7 });
  });

  it('ignora duplicatas: dois treinos no mesmo dia contam como um dia', () => {
    const days = ['2026-08-22', '2026-08-22', '2026-08-21'];
    expect(calculateStreak(days, '2026-08-22')).toMatchObject({ current: 2, totalDays: 2 });
  });

  it('aceita entrada fora de ordem', () => {
    const days = ['2026-08-22', '2026-08-20', '2026-08-21'];
    expect(calculateStreak(days, '2026-08-22').current).toBe(3);
  });

  it('atravessa a virada de mês', () => {
    const days = ['2026-07-30', '2026-07-31', '2026-08-01'];
    expect(calculateStreak(days, '2026-08-01').current).toBe(3);
  });

  it('atravessa a virada de ano', () => {
    const days = ['2026-12-31', '2027-01-01'];
    expect(calculateStreak(days, '2027-01-01').current).toBe(2);
  });

  it('lida com ano bissexto', () => {
    const days = ['2028-02-28', '2028-02-29', '2028-03-01'];
    expect(calculateStreak(days, '2028-03-01').current).toBe(3);
  });

  it('descarta datas malformadas em vez de quebrar', () => {
    const days = ['2026-08-22', 'ontem', ''];
    expect(calculateStreak(days, '2026-08-22')).toMatchObject({ current: 1, totalDays: 1 });
  });
});

describe('protocolDay', () => {
  it('quem começou hoje está no dia 1', () => {
    expect(protocolDay('2026-08-22', '2026-08-22')).toBe(1);
  });

  it('conta o dia corrente do protocolo', () => {
    expect(protocolDay('2026-08-07', '2026-08-22')).toBe(16);
  });

  it('nunca devolve menos que 1', () => {
    expect(protocolDay('2026-09-01', '2026-08-22')).toBe(1);
  });
});

describe('marcos', () => {
  it('detecta o marco exato', () => {
    expect(milestoneReached(30)).toBe(30);
    expect(milestoneReached(31)).toBeNull();
  });

  it('aponta o próximo marco', () => {
    expect(nextMilestone(25)).toEqual({ target: 30, remaining: 5 });
    expect(nextMilestone(400)).toBeNull();
  });
});
