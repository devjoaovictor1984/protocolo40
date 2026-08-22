import type { Metadata } from 'next';
import Link from 'next/link';

import { ForgotPasswordForm } from '@/features/auth/components/auth-forms';

export const metadata: Metadata = {
  title: 'Recuperar senha',
  robots: { index: false, follow: false },
};

export default function EsqueciSenhaPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Recuperar senha</h1>
        <p className="text-muted-foreground">
          Informe seu e-mail e enviamos um link para você criar uma nova senha.
        </p>
      </div>

      <ForgotPasswordForm />

      <Link href="/login" className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4">
        Voltar para o login
      </Link>
    </div>
  );
}
