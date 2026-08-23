'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Fronteira de erro da aplicação.
 * O usuário vê o que aconteceu e como sair dali — nunca uma stack trace.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[protocolo40]', error);
  }, [error]);

  return (
    <main className="pt-safe px-safe flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <AlertTriangle aria-hidden className="text-muted-foreground size-10" />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Algo deu errado aqui</h1>
        <p className="text-muted-foreground max-w-sm">
          Não conseguimos carregar esta tela. Seus treinos estão salvos — nada foi perdido.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground font-mono text-xs">Código: {error.digest}</p>
        ) : null}
      </div>

      <Button onClick={reset} size="lg" className="h-12">
        Tentar novamente
      </Button>
    </main>
  );
}
