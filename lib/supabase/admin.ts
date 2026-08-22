import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/**
 * Cliente com service role — ignora RLS.
 *
 * Só existe para o worker de vídeo e para rotinas administrativas (exclusão de
 * conta, limpeza de storage). O `server-only` acima faz o build quebrar se algum
 * componente de cliente importar este módulo, ainda que por engano.
 *
 * Nunca exponha o resultado desta função a código que roda no navegador.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY ausente. Este cliente só pode ser usado no servidor, ' +
        'com a variável configurada no ambiente.',
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
