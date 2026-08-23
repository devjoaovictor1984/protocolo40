import type { Metadata } from 'next';
import Link from 'next/link';

import { Separator } from '@/components/ui/separator';
import { LoginForm } from '@/features/auth/components/auth-forms';
import { GoogleButton } from '@/features/auth/components/google-button';

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse sua conta e continue sua sequência.',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const redirectTo = typeof params.redirect === 'string' ? params.redirect : undefined;
  const erro = typeof params.erro === 'string' ? params.erro : undefined;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Entrar</h1>
        <p className="text-muted-foreground">Bom te ver de volta. Seus 20 minutos esperam.</p>
      </div>

      {erro ? (
        <p role="status" className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border p-3 text-sm">
          Sua sessão expirou. Entre novamente para continuar.
        </p>
      ) : null}

      <GoogleButton next={redirectTo ?? '/hoje'} />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs tracking-wide uppercase">ou</span>
        <Separator className="flex-1" />
      </div>

      <LoginForm redirectTo={redirectTo} />

      <div className="flex flex-col gap-3 text-sm">
        <Link href="/esqueci-senha" className="text-muted-foreground hover:text-foreground underline underline-offset-4">
          Esqueci minha senha
        </Link>
        <p className="text-muted-foreground">
          Ainda não tem conta?{' '}
          <Link href="/cadastro" className="text-foreground font-medium underline underline-offset-4">
            Comece seu protocolo
          </Link>
        </p>
      </div>
    </div>
  );
}
