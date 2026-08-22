'use client';

import { createContext, useContext, useMemo } from 'react';

import { todayIn } from '@/services/calendar';

/**
 * Dados de sessão que as ilhas de cliente precisam.
 *
 * O servidor já carregou tudo isso; passar por contexto evita que cada
 * componente refaça a consulta — e mantém o IndexedDB escopado ao usuário certo.
 */
export type SessionValue = {
  userId: string;
  username: string;
  fullName: string | null;
  timezone: string;
  protocolStartedOn: string;
  dailyGoalSeconds: number;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionValue;
  children: React.ReactNode;
}) {
  const memo = useMemo(() => value, [value]);
  return <SessionContext.Provider value={memo}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession precisa estar dentro de SessionProvider.');
  }
  return context;
}

/** O dia de hoje no fuso do usuário. Recalculado a cada render, de propósito. */
export function useToday(): string {
  const { timezone } = useSession();
  return todayIn(timezone);
}
