import type { Metadata } from 'next';

import { ResetPasswordForm } from '@/features/auth/components/auth-forms';

export const metadata: Metadata = {
  title: 'Nova senha',
  robots: { index: false, follow: false },
};

export default function RedefinirSenhaPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Nova senha</h1>
        <p className="text-muted-foreground">Escolha uma senha e você já entra direto.</p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
