'use client';

import { useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

/**
 * Ir para o pagamento.
 *
 * O redirecionamento é decidido no servidor, que cria a sessão de checkout com
 * o preço vindo do banco. O cliente nunca informa valor nem plano de forma que
 * o servidor aceite cegamente — só o slug, que é conferido lá.
 *
 * Enquanto a cobrança não estiver ligada, o botão diz isso em vez de abrir uma
 * tela de erro.
 */
export function CheckoutButton({ slug, disponivel }: { slug: string; disponivel: boolean }) {
  const [indo, setIndo] = useState(false);

  if (!disponivel) {
    return (
      <div className="flex flex-col gap-1">
        <Button className="h-12" disabled>
          Em breve
        </Button>
        <p className="text-muted-foreground text-xs">
          A cobrança ainda não está ativa. Enquanto isso, fale com a gente pela tela de Ajuda.
        </p>
      </div>
    );
  }

  async function assinar() {
    setIndo(true);

    try {
      const resposta = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });

      const dados = (await resposta.json()) as { url?: string; erro?: string };

      if (!resposta.ok || !dados.url) {
        throw new Error(dados.erro ?? 'Não foi possível abrir o pagamento.');
      }

      window.location.href = dados.url;
    } catch (erro) {
      setIndo(false);
      toast.error('Não conseguimos abrir o pagamento.', {
        description: erro instanceof Error ? erro.message : 'Tente novamente em instantes.',
      });
    }
  }

  return (
    <Button className="h-14 text-base font-semibold" disabled={indo} onClick={() => void assinar()}>
      {indo ? (
        <Loader2 aria-hidden className="size-4 animate-spin" />
      ) : (
        <CreditCard aria-hidden className="size-4" />
      )}
      {indo ? 'Abrindo…' : 'ASSINAR'}
    </Button>
  );
}
