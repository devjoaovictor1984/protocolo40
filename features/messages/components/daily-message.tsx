'use client';

import { useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { MensagemDoDia } from '@/features/messages/repository';

/**
 * Mensagem do dia.
 *
 * A frase vem primeiro e o versículo depois, recolhido: quem abre o app às
 * seis da manhã quer um empurrão em uma linha, não um estudo. Quem quiser o
 * texto inteiro toca uma vez e ele aparece — e fica aberto enquanto a pessoa
 * estiver nesta tela.
 */
export function DailyMessage({ mensagem }: { mensagem: MensagemDoDia }) {
  const [aberto, setAberto] = useState(false);

  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <p className="text-base leading-snug font-semibold">{mensagem.message}</p>

      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
        className="text-muted-foreground hover:text-foreground flex min-h-9 items-center gap-1.5 self-start text-xs font-medium"
      >
        <BookOpen aria-hidden className="size-3.5" />
        {mensagem.reference}
        <ChevronDown
          aria-hidden
          className={cn('size-3.5 transition-transform', aberto && 'rotate-180')}
        />
      </button>

      {aberto ? (
        <blockquote className="border-primary/40 text-muted-foreground border-l-2 pl-3 text-sm leading-relaxed italic">
          {mensagem.verse}
          <footer className="mt-1 text-[11px] not-italic">
            {mensagem.reference} · João Ferreira de Almeida
          </footer>
        </blockquote>
      ) : null}
    </section>
  );
}
