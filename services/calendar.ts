/**
 * Datas do protocolo.
 *
 * Tudo aqui trabalha com a string `yyyy-MM-dd` no fuso do usuário — o mesmo
 * formato de `workouts.workout_date`. Nenhuma função depende do relógio da
 * máquina: quando precisa de "agora", recebe como argumento.
 */

export type DayKey = string;

const DAY_MS = 86_400_000;

/** O dia de hoje no fuso do usuário, e não no fuso do servidor. */
export function todayIn(timezone: string, now: Date = new Date()): DayKey {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    // fuso inválido no perfil não pode derrubar o dashboard
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }
}

export function toDayNumber(day: DayKey): number {
  const [year, month, date] = day.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, date) / DAY_MS);
}

export function fromDayNumber(value: number): DayKey {
  return new Date(value * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(day: DayKey, amount: number): DayKey {
  return fromDayNumber(toDayNumber(day) + amount);
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function isValidDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDayNumber(value));
}

/** `2026-08-22` → `{ year: 2026, month: 8, date: 22 }` */
export function parseDay(day: DayKey) {
  const [year, month, date] = day.split('-').map(Number);
  return { year, month, date };
}

export function monthKey(day: DayKey): string {
  return day.slice(0, 7);
}

export function startOfMonth(day: DayKey): DayKey {
  return `${monthKey(day)}-01`;
}

export function endOfMonth(day: DayKey): DayKey {
  const { year, month } = parseDay(day);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey(day)}-${String(last).padStart(2, '0')}`;
}

/** 0 = segunda … 6 = domingo. A semana brasileira começa na segunda. */
export function weekdayIndex(day: DayKey): number {
  const { year, month, date } = parseDay(day);
  const jsDay = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return (jsDay + 6) % 7;
}

export type CalendarCell = {
  day: DayKey;
  inMonth: boolean;
};

/**
 * Grade do mês, alinhada de segunda a domingo, com os dias vizinhos
 * completando a primeira e a última semana.
 */
export function monthGrid(reference: DayKey): CalendarCell[] {
  const first = startOfMonth(reference);
  const last = endOfMonth(reference);
  const lead = weekdayIndex(first);
  const total = daysBetween(first, last) + 1;
  const cells: CalendarCell[] = [];

  for (let i = 0; i < lead; i += 1) {
    cells.push({ day: addDays(first, i - lead), inMonth: false });
  }
  for (let i = 0; i < total; i += 1) {
    cells.push({ day: addDays(first, i), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: addDays(last, cells.length - lead - total + 1), inMonth: false });
  }

  return cells;
}

/** Os últimos `count` dias, do mais antigo para o mais recente. */
export function lastDays(today: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, i) => addDays(today, i - count + 1));
}

/** Segunda-feira da semana de `day`. Base dos gráficos semanais. */
export function startOfWeek(day: DayKey): DayKey {
  return addDays(day, -weekdayIndex(day));
}

/**
 * Como a semana se apresenta num cabeçalho.
 *
 * As duas primeiras têm nome porque é assim que se fala delas; da terceira em
 * diante só o intervalo distingue uma da outra. O mês entra uma vez só quando
 * a semana não atravessa a virada.
 */
export function weekLabel(monday: DayKey, today: DayKey): string {
  const atual = startOfWeek(today);
  if (monday === atual) return 'Esta semana';
  if (monday === addDays(atual, -7)) return 'Semana passada';

  const sunday = addDays(monday, 6);
  const a = parseDay(monday);
  const b = parseDay(sunday);

  return a.month === b.month
    ? `${a.date} a ${b.date} de ${MONTH_NAMES[a.month - 1]}`
    : `${a.date} de ${MONTH_NAMES[a.month - 1]} a ${b.date} de ${MONTH_NAMES[b.month - 1]}`;
}

export const WEEKDAY_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const;
export const WEEKDAY_NAMES = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
] as const;

export const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

export function monthLabel(day: DayKey): string {
  const { month, year } = parseDay(day);
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

/** `2026-08-22` → `22/08/2026` */
export function formatDay(day: DayKey): string {
  const { year, month, date } = parseDay(day);
  return `${String(date).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

/** `22/08` — para eixos de gráfico e listas densas. */
export function formatDayShort(day: DayKey): string {
  const { month, date } = parseDay(day);
  return `${String(date).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

/** "hoje", "ontem", "há 3 dias", "22/08/2026". */
export function relativeDay(day: DayKey, today: DayKey): string {
  const diff = daysBetween(day, today);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  if (diff > 1 && diff < 7) return `há ${diff} dias`;
  if (diff === -1) return 'amanhã';
  return formatDay(day);
}

/** Saudação pelo horário local. */
export function greeting(timezone: string, now: Date = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hour12: false }).format(now),
  );
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
