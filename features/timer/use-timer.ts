'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '@/features/session/session-context';
import { clearSession, readSession, writeSession } from '@/lib/offline/db';
import { todayIn } from '@/services/calendar';
import {
  addMinutes as addMinutesTo,
  displaySeconds,
  elapsedSeconds,
  finishSession,
  isPaused as sessionPaused,
  pause as pauseSession,
  progressRatio,
  resume as resumeSession,
  toggleMode as toggleSessionMode,
  type TimerSession,
} from '@/services/duration';
import type { ActiveSession } from '@/types/offline';

/**
 * Cronômetro do treino.
 *
 * O tempo nunca é contado: é calculado. `startedAt` e as pausas ficam gravados
 * no IndexedDB, e cada quadro faz a subtração de novo contra o relógio. Isso é
 * o que faz o cronômetro sobreviver ao PWA em segundo plano, à tela bloqueada e
 * até a fechar e reabrir o aplicativo no meio do treino.
 */

export type StartOptions = {
  templateId?: string | null;
  templateTitle?: string | null;
  title?: string | null;
  targetSeconds?: number;
};

export function useTimer() {
  const { userId, timezone, dailyGoalSeconds } = useSession();

  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  // ---- carga inicial: uma sessão interrompida volta exatamente de onde parou
  useEffect(() => {
    let alive = true;

    readSession()
      .then((stored) => {
        if (!alive) return;
        setSession(stored && stored.user_id === userId ? stored : null);
      })
      .catch(() => setSession(null))
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [userId]);

  // ---- relógio: só re-renderiza quando o segundo exibido muda
  useEffect(() => {
    if (!session) return;

    const tick = () => setNow(Date.now());
    tick();

    const interval = window.setInterval(tick, 250);
    const onVisible = () => {
      // volta do segundo plano: recalcula na hora, sem esperar o próximo tick
      if (document.visibilityState === 'visible') tick();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
    };
  }, [session]);

  // ---- mantém a tela acesa durante o treino, onde houver suporte
  const releaseWakeLock = useCallback(() => {
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  useEffect(() => {
    const active = session !== null && !sessionPaused(session);

    if (!active) {
      releaseWakeLock();
      return;
    }

    let cancelled = false;

    const request = async () => {
      try {
        if (!('wakeLock' in navigator)) return;
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        wakeLock.current = sentinel;
      } catch {
        // sem wake lock o cronômetro continua correto; só a tela apaga
      }
    };

    void request();

    // o navegador solta o wake lock ao sair da aba: pede de novo na volta
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wakeLock.current) void request();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, releaseWakeLock]);

  const persist = useCallback(async (next: ActiveSession | null) => {
    setSession(next);
    if (next) {
      await writeSession({ ...next, updatedAt: Date.now() });
    } else {
      await clearSession();
    }
  }, []);

  const apply = useCallback(
    (transform: (current: TimerSession) => TimerSession) => {
      setSession((current) => {
        if (!current) return current;
        const updated = { ...current, ...transform(current) };
        void writeSession({ ...updated, updatedAt: Date.now() });
        return updated;
      });
      setNow(Date.now());
    },
    [],
  );

  const start = useCallback(
    async (options: StartOptions = {}) => {
      const fresh: ActiveSession = {
        id: 'atual',
        client_id: crypto.randomUUID(),
        user_id: userId,
        startedAt: Date.now(),
        pauses: [],
        targetSeconds: options.targetSeconds ?? dailyGoalSeconds,
        mode: 'regressivo',
        templateId: options.templateId ?? null,
        templateTitle: options.templateTitle ?? null,
        title: options.title ?? options.templateTitle ?? null,
        rounds: 0,
        checked: [],
        updatedAt: Date.now(),
      };

      await persist(fresh);
      setNow(Date.now());
      return fresh;
    },
    [dailyGoalSeconds, persist, userId],
  );

  const pause = useCallback(() => apply((current) => pauseSession(current, Date.now())), [apply]);
  const resume = useCallback(() => apply((current) => resumeSession(current, Date.now())), [apply]);
  const toggleMode = useCallback(() => apply(toggleSessionMode), [apply]);
  const addMinutes = useCallback(
    (minutes: number) => apply((current) => addMinutesTo(current, minutes)),
    [apply],
  );

  const setRounds = useCallback((rounds: number) => {
    setSession((current) => {
      if (!current) return current;
      const updated = { ...current, rounds: Math.max(0, rounds) };
      void writeSession({ ...updated, updatedAt: Date.now() });
      return updated;
    });
  }, []);

  const toggleChecked = useCallback((key: string) => {
    setSession((current) => {
      if (!current) return current;
      const checked = current.checked.includes(key)
        ? current.checked.filter((item) => item !== key)
        : [...current.checked, key];
      const updated = { ...current, checked };
      void writeSession({ ...updated, updatedAt: Date.now() });
      return updated;
    });
  }, []);

  /** Fecha a sessão e devolve o que o treino precisa para ser gravado. */
  const finish = useCallback(async () => {
    if (!session) return null;

    const at = Date.now();
    const result = finishSession(session, at);

    releaseWakeLock();
    await clearSession();
    setSession(null);

    return {
      clientId: session.client_id,
      templateId: session.templateId,
      title: session.title,
      rounds: session.rounds,
      workoutDate: todayIn(timezone, new Date(at)),
      ...result,
    };
  }, [releaseWakeLock, session, timezone]);

  /** Descarta a sessão sem gravar nada. */
  const discard = useCallback(async () => {
    releaseWakeLock();
    await persist(null);
  }, [persist, releaseWakeLock]);

  const paused = session ? sessionPaused(session) : false;

  return {
    session,
    loading,
    running: session !== null,
    paused,
    now,
    display: session ? displaySeconds(session, now) : dailyGoalSeconds,
    elapsed: session ? elapsedSeconds(session, now) : 0,
    ratio: session ? progressRatio(session, now) : 0,
    mode: session?.mode ?? 'regressivo',
    rounds: session?.rounds ?? 0,
    start,
    pause,
    resume,
    toggleMode,
    addMinutes,
    setRounds,
    toggleChecked,
    finish,
    discard,
  };
}
