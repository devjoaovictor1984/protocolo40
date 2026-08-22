'use client';

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { isBrowser } from '@/lib/offline/db';
import { useOnlineStatus, useSyncTriggers } from '@/lib/offline/network';
import { retryAll, summarize } from '@/lib/offline/queue';
import { flushQueue } from '@/lib/offline/sync';
import { createClient } from '@/lib/supabase/client';

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'failed';

/**
 * Estado da sincronização para a interface.
 *
 * Fica montado uma vez no shell da aplicação: é ele que dispara o flush quando
 * a conexão volta, quando a janela ganha foco e quando o PWA volta do segundo
 * plano.
 */
export function useSync() {
  const online = useOnlineStatus();
  const queryClient = useQueryClient();

  const queue = useQuery({
    queryKey: ['sync', 'queue'],
    queryFn: summarize,
    enabled: isBrowser(),
    refetchInterval: 15_000,
    initialData: { pending: 0, failed: 0 },
  });

  const flush = useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      return flushQueue(supabase);
    },
    onSettled: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['sync', 'queue'] });
      if (result && result.processed > 0) {
        // o que chegou ao servidor muda dashboard, histórico e estatísticas
        void queryClient.invalidateQueries({ queryKey: ['workouts'] });
        void queryClient.invalidateQueries({ queryKey: ['stats'] });
      }
    },
  });

  const trigger = useCallback(() => {
    if (!isBrowser() || !navigator.onLine) return;
    flush.mutate();
  }, [flush]);

  useSyncTriggers(trigger);

  const retry = useCallback(async () => {
    await retryAll();
    trigger();
  }, [trigger]);

  const status: SyncStatus = useMemo(() => {
    if (queue.data.failed > 0) return 'failed';
    if (!online) return 'offline';
    if (queue.data.pending > 0) return 'pending';
    return 'synced';
  }, [online, queue.data.failed, queue.data.pending]);

  return {
    status,
    online,
    pending: queue.data.pending,
    failed: queue.data.failed,
    syncing: flush.isPending,
    sync: trigger,
    retry,
  };
}
