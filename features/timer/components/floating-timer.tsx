'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Pause, Timer } from 'lucide-react';

import { useSession } from '@/features/session/session-context';
import { readSession } from '@/lib/offline/db';
import { cn } from '@/lib/utils';
import {
  displaySeconds,
  formatClock,
  isPaused,
  progressRatio,
  type TimerSession,
} from '@/services/duration';

/**
 * O cronômetro que segue você pelo app.
 *
 * O treino **sempre** sobreviveu a sair da tela — o tempo é calculado a partir
 * de `startedAt` gravado no IndexedDB, não contado por um `setInterval`. O que
 * faltava era isso aparecer: quem saía para ver o histórico não tinha sinal
 * nenhum de que o relógio continuava correndo, e o caminho de volta era procurar
 * o botão de treinar como se fosse começar de novo.
 *
 * Lê direto do IndexedDB e não do `useTimer`: este balão vive fora da tela do
 * treino, e montar o cronômetro inteiro em toda página seria pagar caro por um
 * número. Aqui só se lê.
 *
 * Some na própria tela do treino — apontar para onde a pessoa já está é ruído.
 */

/** De quanto em quanto o balão relê o relógio. */
const RITMO_MS = 1000;

export function FloatingTimer() {
  const pathname = usePathname();
  const { userId } = useSession();

  const [sessao, setSessao] = useState<TimerSession | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  const naTelaDoTreino = pathname === '/treinar' || pathname.startsWith('/treino/');

  useEffect(() => {
    // na tela do treino o balão não existe: apontar para onde a pessoa já está
    // é ruído. Aqui só se evita o trabalho; quem não desenha é o `return` abaixo
    if (naTelaDoTreino) return;

    let vivo = true;

    const ler = async () => {
      try {
        const guardada = await readSession();
        if (!vivo) return;
        setSessao(guardada && guardada.user_id === userId ? guardada : null);
        setAgora(Date.now());
      } catch {
        // sem IndexedDB o balão simplesmente não aparece
      }
    };

    void ler();
    const id = window.setInterval(ler, RITMO_MS);

    // voltando do segundo plano, relê na hora em vez de esperar o próximo ciclo
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void ler();
    };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      vivo = false;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [naTelaDoTreino, userId]);

  if (naTelaDoTreino || !sessao) return null;

  const pausado = isPaused(sessao);
  const fracao = progressRatio(sessao, agora);
  const relogio = formatClock(displaySeconds(sessao, agora));

  return (
    <Link
      href="/treinar"
      aria-label={`Treino em andamento, ${relogio}. Voltar ao cronômetro`}
      className={cn(
        // acima da barra de baixo no celular; no desktop não há barra
        'pb-safe fixed right-4 bottom-20 z-50 lg:bottom-6',
        'bg-background/95 border-border flex items-center gap-2.5 rounded-full border py-2 pr-4 pl-2.5',
        'shadow-lg backdrop-blur transition-transform active:scale-95',
        'animate-in fade-in slide-in-from-bottom-2',
      )}
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center">
        {/* o anel repete o progresso do treino, em miniatura */}
        <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-muted" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0, Math.min(1, fracao)) * 94.2} 94.2`}
            className={cn(pausado ? 'stroke-muted-foreground' : 'stroke-primary')}
          />
        </svg>

        {pausado ? (
          <Pause aria-hidden className="text-muted-foreground size-3.5" />
        ) : (
          <Timer aria-hidden className="text-primary size-3.5" />
        )}
      </span>

      <span className="flex flex-col leading-none">
        <span className="tnum text-base font-extrabold tracking-tight">{relogio}</span>
        <span className="text-muted-foreground text-[10px] font-medium">
          {/* o estado é dito em palavra, e não só pela cor do anel */}
          {pausado ? 'pausado' : 'treinando'}
        </span>
      </span>
    </Link>
  );
}
