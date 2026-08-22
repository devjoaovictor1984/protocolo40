import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

/**
 * Cliente do navegador — chave anônima, sujeito à RLS.
 *
 * É por aqui que passam as escritas local-first (treino, medida, foto): quando
 * a fila offline sobe, não existe Server Action disponível, e a autorização
 * fica onde sempre esteve, no banco.
 */
export function createClient() {
  return createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
}
