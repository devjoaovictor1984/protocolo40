/**
 * Tempo de treino.
 *
 * A duração nunca vem de um contador incrementado por setInterval: um timer de
 * JavaScript para de disparar quando o PWA vai para segundo plano ou a tela
 * bloqueia. A fonte da verdade é sempre `startedAt` mais os intervalos de pausa,
 * e o tempo decorrido é recalculado a partir do relógio.
 */

export type PauseInterval = {
  /** epoch em milissegundos */
  at: number;
  /** epoch em milissegundos; null enquanto a pausa não terminou */
  until: number | null;
};

export type TimerSession = {
  startedAt: number;
  pauses: PauseInterval[];
  /** Duração alvo em segundos. 20 minutos é o padrão, não uma trava. */
  targetSeconds: number;
  mode: 'regressivo' | 'progressivo';
};

export const DEFAULT_TARGET_SECONDS = 20 * 60;

/** Soma das pausas já ocorridas até `now`. */
function pausedMs(pauses: readonly PauseInterval[], now: number): number {
  return pauses.reduce((total, pause) => {
    const end = pause.until ?? now;
    return total + Math.max(0, end - pause.at);
  }, 0);
}

export function isPaused(session: TimerSession): boolean {
  const last = session.pauses.at(-1);
  return last !== undefined && last.until === null;
}

/** Segundos efetivamente treinados, descontadas as pausas. */
export function elapsedSeconds(session: TimerSession, now: number): number {
  const raw = now - session.startedAt - pausedMs(session.pauses, now);
  return Math.max(0, Math.floor(raw / 1000));
}

/** Segundos que faltam no modo regressivo. Chega a zero e para — não fica negativo. */
export function remainingSeconds(session: TimerSession, now: number): number {
  return Math.max(0, session.targetSeconds - elapsedSeconds(session, now));
}

/** O que o cronômetro mostra, conforme o modo escolhido. */
export function displaySeconds(session: TimerSession, now: number): number {
  return session.mode === 'regressivo' ? remainingSeconds(session, now) : elapsedSeconds(session, now);
}

/** 0 a 1. No modo progressivo o anel continua cheio depois da meta. */
export function progressRatio(session: TimerSession, now: number): number {
  if (session.targetSeconds <= 0) return 0;
  return Math.min(1, elapsedSeconds(session, now) / session.targetSeconds);
}

export function pause(session: TimerSession, now: number): TimerSession {
  if (isPaused(session)) return session;
  return { ...session, pauses: [...session.pauses, { at: now, until: null }] };
}

export function resume(session: TimerSession, now: number): TimerSession {
  if (!isPaused(session)) return session;
  const pauses = session.pauses.slice();
  pauses[pauses.length - 1] = { ...pauses[pauses.length - 1], until: now };
  return { ...session, pauses };
}

/** "Adicionar tempo" mexe na meta, nunca no tempo já treinado. */
export function addMinutes(session: TimerSession, minutes: number): TimerSession {
  const target = Math.min(86_400, Math.max(60, session.targetSeconds + minutes * 60));
  return { ...session, targetSeconds: target };
}

export function toggleMode(session: TimerSession): TimerSession {
  return { ...session, mode: session.mode === 'regressivo' ? 'progressivo' : 'regressivo' };
}

export function startSession(now: number, targetSeconds = DEFAULT_TARGET_SECONDS): TimerSession {
  return { startedAt: now, pauses: [], targetSeconds, mode: 'regressivo' };
}

/**
 * Fecha a sessão. Uma pausa aberta é encerrada em `now` para que o tempo parado
 * não entre na duração.
 */
export function finishSession(session: TimerSession, now: number) {
  const closed = isPaused(session) ? resume(session, now) : session;
  return {
    startedAt: new Date(closed.startedAt).toISOString(),
    finishedAt: new Date(now).toISOString(),
    durationSeconds: elapsedSeconds(closed, now),
  };
}

/** `20:00`, ou `1:05:30` quando passa de uma hora. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Forma curta para listas e cards: `20 min`, `1h 05`. */
export function formatDurationShort(totalSeconds: number): string {
  const minutes = Math.round(Math.max(0, totalSeconds) / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest.toString().padStart(2, '0')}`;
}
