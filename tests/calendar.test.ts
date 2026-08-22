import { describe, expect, it } from 'vitest';

import {
  addDays,
  daysBetween,
  endOfMonth,
  formatDay,
  greeting,
  lastDays,
  monthGrid,
  monthLabel,
  relativeDay,
  startOfMonth,
  startOfWeek,
  todayIn,
  weekdayIndex,
} from '@/services/calendar';

describe('todayIn', () => {
  it('usa o fuso do usuário, não o do servidor', () => {
    // 03:00 UTC de 23/08 ainda é dia 22 em São Paulo
    const instant = new Date('2026-08-23T02:00:00.000Z');
    expect(todayIn('America/Sao_Paulo', instant)).toBe('2026-08-22');
    expect(todayIn('UTC', instant)).toBe('2026-08-23');
  });

  it('cai para São Paulo quando o fuso do perfil é inválido', () => {
    const instant = new Date('2026-08-22T15:00:00.000Z');
    expect(todayIn('Marte/Olympus', instant)).toBe('2026-08-22');
  });
});

describe('aritmética de dias', () => {
  it('soma e subtrai atravessando meses', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('atravessa ano bissexto', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('conta a distância entre dois dias', () => {
    expect(daysBetween('2026-08-01', '2026-08-22')).toBe(21);
    expect(daysBetween('2026-08-22', '2026-08-01')).toBe(-21);
  });
});

describe('limites de mês e semana', () => {
  it('encontra o primeiro e o último dia', () => {
    expect(startOfMonth('2026-08-22')).toBe('2026-08-01');
    expect(endOfMonth('2026-08-22')).toBe('2026-08-31');
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
  });

  it('a semana começa na segunda', () => {
    // 2026-08-22 é um sábado
    expect(weekdayIndex('2026-08-22')).toBe(5);
    expect(startOfWeek('2026-08-22')).toBe('2026-08-17');
    expect(startOfWeek('2026-08-17')).toBe('2026-08-17');
  });
});

describe('monthGrid', () => {
  it('devolve semanas completas', () => {
    const cells = monthGrid('2026-08-15');
    expect(cells.length % 7).toBe(0);
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(31);
  });

  it('começa numa segunda-feira', () => {
    expect(weekdayIndex(monthGrid('2026-08-15')[0].day)).toBe(0);
  });

  it('inclui o primeiro e o último dia do mês', () => {
    const days = monthGrid('2026-02-10').map((cell) => cell.day);
    expect(days).toContain('2026-02-01');
    expect(days).toContain('2026-02-28');
  });
});

describe('lastDays', () => {
  it('devolve a janela terminando em hoje', () => {
    expect(lastDays('2026-08-22', 3)).toEqual(['2026-08-20', '2026-08-21', '2026-08-22']);
  });
});

describe('formatação', () => {
  it('usa o formato brasileiro', () => {
    expect(formatDay('2026-08-22')).toBe('22/08/2026');
    expect(monthLabel('2026-08-22')).toBe('agosto de 2026');
  });

  it('descreve dias próximos em palavras', () => {
    expect(relativeDay('2026-08-22', '2026-08-22')).toBe('hoje');
    expect(relativeDay('2026-08-21', '2026-08-22')).toBe('ontem');
    expect(relativeDay('2026-08-19', '2026-08-22')).toBe('há 3 dias');
    expect(relativeDay('2026-07-01', '2026-08-22')).toBe('01/07/2026');
  });
});

describe('greeting', () => {
  it('muda com o horário local', () => {
    const morning = new Date('2026-08-22T12:00:00.000Z'); // 09:00 em São Paulo
    const evening = new Date('2026-08-22T23:00:00.000Z'); // 20:00 em São Paulo
    expect(greeting('America/Sao_Paulo', morning)).toBe('Bom dia');
    expect(greeting('America/Sao_Paulo', evening)).toBe('Boa noite');
  });
});
