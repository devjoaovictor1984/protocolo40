import type { Metadata } from 'next';
import Link from 'next/link';

import { Separator } from '@/components/ui/separator';
import { SignUpForm } from '@/features/auth/components/auth-forms';
import { GoogleButton } from '@/features/auth/components/google-button';

export const metadata: Metadata = {
  title: 'Criar conta',
  description: 'Comece seu protocolo hoje. 20 minutos por dia.',
  robots: { index: false, follow: false },
};

export default function CadastroPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Comece seu protocolo</h1>
        <p className="text-muted-foreground">
          Leva menos de um minuto. Você começa a treinar hoje mesmo.
        </p>
      </div>

      <GoogleButton next="/onboarding" />

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs tracking-wide uppercase">ou</span>
        <Separator className="flex-1" />
      </div>

      <SignUpForm />

      <p className="text-muted-foreground text-sm">
        Já tem conta?{' '}
        <Link href="/login" className="text-foreground font-medium underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </div>
  );
}
