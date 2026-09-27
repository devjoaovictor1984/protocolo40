'use client';

import { useEffect } from 'react';
import { unstable_isUnrecognizedActionError } from 'next/navigation';
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
    /*
     * Botão de um build velho: o app ficou aberto durante um deploy e chamou
     * uma Server Action que não existe mais. Não é erro de ninguém — é só o
     * app desatualizado. Recarregar traz a versão nova, e a pessoa toca de
     * novo. Uma vez só: se o erro voltar depois do recarregamento, é outra
     * coisa, e aí a tela abaixo aparece.
     */
    if (unstable_isUnrecognizedActionError(error)) {
      try {
        if (!sessionStorage.getItem('p20x:recarregou')) {
          sessionStorage.setItem('p20x:recarregou', '1');
          window.location.reload();
          return;
        }
      } catch {
        // sem sessionStorage: cai na tela de erro, que ao menos oferece saída
      }
    }
    console.error('[p20x]', error);
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
