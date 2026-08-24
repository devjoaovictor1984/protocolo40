'use client';

import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/features/session/session-context';
import { createClient } from '@/lib/supabase/client';

/**
 * Os dias de descanso registrados.
 *
 * Vêm do servidor e não do IndexedDB: descanso é um registro pequeno, raro e
 * que precisa da checagem de limite no banco. Colocá-lo na fila offline seria
 * complexidade sem ganho — quem descansa não está com o telefone no bolso no
 * meio de um treino.
 */
export function useRestDays() {
  const { userId } = useSession();

  return useQuery({
    queryKey: ['rest-days', userId],
    queryFn: async (): Promise<string[]> => {
      const supabase = createClient();
      const { data } = await supabase
        .from('rest_days')
        .select('day')
        .eq('user_id', userId)
        .order('day', { ascending: false })
        .limit(400);

      return (data ?? []).map((linha) => linha.day);
    },
    staleTime: 60_000,
  });
}
