import { z } from 'zod';

/**
 * Variáveis de ambiente validadas na borda da aplicação.
 *
 * As `NEXT_PUBLIC_*` vão para o bundle do navegador de propósito — são a URL do
 * projeto e a chave publicável, ambas protegidas por RLS. A chave secreta NUNCA
 * aparece aqui: ela mora em `lib/supabase/admin.ts`, que é `server-only`.
 */

/** Um campo salvo em branco no painel chega como "" e não como undefined. */
function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL precisa ser uma URL válida'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY ausente'),
  NEXT_PUBLIC_SITE_URL: z.string().url('NEXT_PUBLIC_SITE_URL precisa ser uma URL válida').optional(),
});

const parsed = publicSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: optional(process.env.NEXT_PUBLIC_SITE_URL),
});

if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.message).join('\n  ');
  throw new Error(
    `Configuração do Supabase incompleta:\n  ${missing}\n\n` +
      'Copie .env.example para .env.local e preencha com os dados do seu projeto.',
  );
}

/**
 * Ordem de resolução da URL pública:
 *
 * 1. o valor configurado, que é o domínio final e estável;
 * 2. o domínio de produção da Vercel, quando o projeto já tem um;
 * 3. a URL do deploy atual — muda a cada build, serve para preview;
 * 4. localhost.
 *
 * Isso importa porque é daqui que saem os links de confirmação de e-mail e de
 * recuperação de senha: apontar para o deploy errado deixa o usuário preso.
 */
function resolveSiteUrl(): string {
  const configured = parsed.success ? parsed.data.NEXT_PUBLIC_SITE_URL : undefined;
  if (configured) return configured.replace(/\/$/, '');

  const production = optional(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return `https://${production}`;

  const deployment = optional(process.env.VERCEL_URL);
  if (deployment) return `https://${deployment}`;

  return 'http://localhost:3000';
}

export const env = {
  supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  siteUrl: resolveSiteUrl(),
} as const;
