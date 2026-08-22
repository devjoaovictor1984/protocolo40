'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * `false` no servidor e no primeiro render, `true` depois da hidratação.
 *
 * Serve para o que só existe no cliente — tema atual, preferências do aparelho —
 * sem provocar diferença entre o HTML do servidor e o do navegador, e sem
 * chamar setState dentro de um efeito.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
