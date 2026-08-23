'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Estado da conexão.
 *
 * `navigator.onLine` mente com frequência (diz online em wi-fi sem saída), por
 * isso o valor também é corrigido pelos eventos e por qualquer sincronização
 * que tenha falhado por rede.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();

    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}

/**
 * Chama `callback` quando vale a pena tentar sincronizar: a conexão voltou, a
 * janela ganhou foco, ou o aplicativo voltou do segundo plano.
 *
 * O `visibilitychange` é o que salva o iOS, onde Background Sync não existe.
 */
export function useSyncTriggers(callback: () => void, intervalMs = 60_000) {
  // guardado numa ref para que trocar de callback não reinstale os ouvintes
  // nem dispare uma sincronização a cada render
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    const run = () => latest.current();

    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };

    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(run, intervalMs);

    run();

    return () => {
      window.removeEventListener('online', run);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
