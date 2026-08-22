import { z } from 'zod';

/**
 * Variáveis de ambiente validadas na borda da aplicação.
 *
 * As `NEXT_PUBLIC_*` vão para o bundle do navegador de propósito — são a URL do
 * projeto e a chave anônima, ambas protegidas por RLS. A service role NUNCA
 * aparece aqui: ela mora em `lib/supabase/admin.ts`, que é `server-only`.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY ausente'),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.message).join('\n  ');
  throw new Error(
    `Configuração do Supabase incompleta:\n  ${missing}\n\n` +
      'Copie .env.example para .env.local e preencha com os dados do seu projeto.',
  );
}

const siteUrl =
  parsed.data.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

export const env = {
  supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  siteUrl,
} as const;
