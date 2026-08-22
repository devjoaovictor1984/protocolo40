/**
 * Sequência de treinos.
 *
 * Função pura: recebe os dias em que houve treino e devolve os números. Sem
 * React, sem Supabase, sem Date.now() implícito — o "hoje" é sempre um
 * argumento, para que o teste não dependa do relógio da máquina.
 *
 * Todas as datas são strings `yyyy-MM-dd` no fuso do usuário. É por isso que
 * `workouts.workout_date` existe como coluna `date`: comparar timestamps com
 * fuso aqui quebraria para quem treina perto da meia-noite.
 */

export type StreakSummary = {
  current: number;
  longest: number;
  totalDays: number;
  lastDay: string | null;
};

const DAY_MS = 86_400_000;

/** `yyyy-MM-dd` → dias desde a época, sem influência de fuso. */
function toDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function isValidDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDayNumber(value));
}

/**
 * @param days  Dias com treino, em qualquer ordem, com repetições permitidas.
 * @param today Dia de referência, no fuso do usuário.
 */
export function calculateStreak(days: readonly string[], today: string): StreakSummary {
  const unique = Array.from(new Set(days.filter(isValidDay))).sort();

  if (unique.length === 0) {
    return { current: 0, longest: 0, totalDays: 0, lastDay: null };
  }

  const numbers = unique.map(toDayNumber);
  const todayNumber = toDayNumber(today);

  let longest = 1;
  let run = 1;
  let currentRunEnd = numbers[0];
  let currentRunLength = 1;

  for (let i = 1; i < numbers.length; i += 1) {
    if (numbers[i] === numbers[i - 1] + 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    currentRunEnd = numbers[i];
    currentRunLength = run;
  }

  // A sequência segue viva durante todo o dia corrente, mesmo antes do treino
  // de hoje acontecer. Só quebra quando o último treino ficou para trás de ontem.
  const gap = todayNumber - currentRunEnd;
  const current = gap <= 1 && gap >= 0 ? currentRunLength : 0;

  return {
    current,
    longest,
    totalDays: unique.length,
    lastDay: unique[unique.length - 1],
  };
}

/**
 * Número do dia dentro do protocolo. O primeiro dia é o DIA 1, não o DIA 0 —
 * quem começou hoje já está no dia 1.
 */
export function protocolDay(startedOn: string, today: string): number {
  if (!isValidDay(startedOn) || !isValidDay(today)) return 1;
  return Math.max(1, toDayNumber(today) - toDayNumber(startedOn) + 1);
}

/** Marcos comemorados. Nada entre eles vira notificação. */
export const MILESTONES = [7, 14, 30, 60, 90, 180, 365] as const;

export type Milestone = (typeof MILESTONES)[number];

/** O marco atingido exatamente com este número de dias, se houver. */
export function milestoneReached(totalDays: number): Milestone | null {
  return MILESTONES.find((m) => m === totalDays) ?? null;
}

/** Próximo marco e quanto falta — usado para dar contexto, nunca para cobrar. */
export function nextMilestone(totalDays: number): { target: Milestone; remaining: number } | null {
  const target = MILESTONES.find((m) => m > totalDays);
  return target ? { target, remaining: target - totalDays } : null;
}
