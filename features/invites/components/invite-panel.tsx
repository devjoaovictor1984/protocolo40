'use client';

import { useState } from 'react';
import { Check, Copy, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

/**
 * Compartilhar o convite.
 *
 * Três caminhos, em ordem de atrito: o compartilhamento nativo do celular
 * (uma toque e a pessoa escolhe onde), o WhatsApp direto (que é onde isso
 * acontece de verdade no Brasil) e copiar o link, para quem prefere colar
 * onde quiser.
 *
 * O botão nativo só aparece se o aparelho tiver a API — no desktop ele
 * simplesmente não existe, em vez de existir e não funcionar.
 */
export function InvitePanel({ link, nome }: { link: string; nome: string }) {
  const [copiado, setCopiado] = useState(false);

  const mensagem =
    `${nome} te chamou para o P20X: 20 minutos de treino por dia, todos os dias. ` +
    `Sem academia e sem equipamento. ${link}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      toast.error('Não conseguimos copiar.', { description: 'Selecione o endereço e copie à mão.' });
    }
  }

  async function compartilhar() {
    try {
      await navigator.share({ title: 'P20X', text: mensagem, url: link });
    } catch {
      // cancelar o compartilhamento não é erro
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border bg-muted/40 flex items-center gap-2 rounded-xl border p-3">
        <code className="min-w-0 flex-1 truncate font-mono text-sm">{link}</code>
        <Button
          size="icon"
          variant="ghost"
          className="size-9 shrink-0"
          aria-label="Copiar o link do convite"
          onClick={() => void copiar()}
        >
          {copiado ? (
            <Check aria-hidden className="text-success size-4" />
          ) : (
            <Copy aria-hidden className="size-4" />
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground flex h-14 items-center justify-center gap-2 rounded-lg text-base font-semibold transition-opacity hover:opacity-90"
        >
          <MessageCircle aria-hidden className="size-5" />
          CONVIDAR PELO WHATSAPP
        </a>

        <CompartilharNativo onCompartilhar={compartilhar} />
      </div>
    </div>
  );
}

function CompartilharNativo({ onCompartilhar }: { onCompartilhar: () => Promise<void> }) {
  // `navigator.share` só existe no navegador, e só em parte deles
  const [disponivel] = useState(
    () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  );

  if (!disponivel) return null;

  return (
    <Button variant="outline" className="h-12" onClick={() => void onCompartilhar()}>
      <Share2 aria-hidden className="size-4" />
      Compartilhar de outro jeito
    </Button>
  );
}
