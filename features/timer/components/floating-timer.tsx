'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Pause, Timer } from 'lucide-react';

import { useSession } from '@/features/session/session-context';
import { useIntervalPrefs } from '@/features/timer/use-interval-prefs';
import { readSession } from '@/lib/offline/db';
import { cn } from '@/lib/utils';
import {
  displaySeconds,
  elapsedSeconds,
  formatClock,
  isPaused,
  progressRatio,
  type TimerSession,
} from '@/services/duration';
import { momentoEm } from '@/services/intervals';

/**
 * O cronômetro que segue você pelo app.
 *
 * O treino sempre sobreviveu a sair da tela — o tempo vem de `startedAt` no
 * IndexedDB, não de um contador. O que faltava era isso aparecer: quem saía
 * para ver o histórico não tinha sinal de que o relógio seguia, e o caminho de
 * volta era procurar o botão de treinar como se fosse começar de novo.
 *
 * **Arrastável** porque ele fica por cima do conteúdo, e o canto certo depende
 * da tela: numa lista longa ele cobre o último item, num formulário cobre o
 * botão. Em vez de adivinhar o canto bom, deixa-se mover — e a posição fica
 * guardada, porque quem moveu uma vez não quer mover de novo.
 *
 * Lê direto do IndexedDB e não do `useTimer`: montar o cronômetro inteiro em
 * cada página seria caro por um número. Aqui só se lê.
 */

const RITMO_MS = 1000;
const CHAVE_POSICAO = 'p20x_balao';

/** Distância mínima das bordas, para o balão nunca sair da tela. */
const MARGEM = 12;

type Posicao = { x: number; y: number };

/**
 * A posição guardada, como loja externa.
 *
 * `useSyncExternalStore` e não um efeito que chama `setState`: ler
 * `localStorage` é olhar para fora do React, e fazer isso num efeito provoca
 * uma segunda renderização em cascata a cada montagem — em toda tela do app,
 * já que este componente vive no layout.
 */
let guardadaEmCache: Posicao | null | undefined;
const ouvintes = new Set<() => void>();

function lerGuardada(): Posicao | null {
  if (guardadaEmCache !== undefined) return guardadaEmCache;

  try {
    const bruto = window.localStorage.getItem(CHAVE_POSICAO);
    guardadaEmCache = bruto ? (JSON.parse(bruto) as Posicao) : null;
  } catch {
    guardadaEmCache = null;
  }

  return guardadaEmCache;
}

const assinarPosicao = (avisar: () => void) => {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
};

/** No servidor não há posição guardada: o balão nasce no canto padrão. */
const semPosicao = () => null;

function guardarPosicao(nova: Posicao) {
  guardadaEmCache = nova;
  try {
    window.localStorage.setItem(CHAVE_POSICAO, JSON.stringify(nova));
  } catch {
    // sem armazenamento a posição vale só nesta sessão
  }
  for (const avisar of ouvintes) avisar();
}

export function FloatingTimer() {
  const pathname = usePathname();
  const router = useRouter();
  const { userId } = useSession();
  const { preferencias } = useIntervalPrefs();

  const [sessao, setSessao] = useState<TimerSession | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const guardada = useSyncExternalStore(assinarPosicao, lerGuardada, semPosicao);
  /** Enquanto o dedo está na tela, a posição é local; ao soltar, vira guardada. */
  const [arrastada, setArrastada] = useState<Posicao | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const posicao = arrastada ?? guardada;

  const alvo = useRef<HTMLDivElement | null>(null);
  const inicio = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const moveu = useRef(false);

  const naTelaDoTreino = pathname === '/treinar' || pathname.startsWith('/treino/');

  useEffect(() => {
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

  /** Prende a posição dentro da tela — girar o aparelho não pode sumir com ele. */
  const dentroDaTela = useCallback((p: Posicao): Posicao => {
    const largura = alvo.current?.offsetWidth ?? 150;
    const altura = alvo.current?.offsetHeight ?? 56;

    return {
      x: Math.min(Math.max(MARGEM, p.x), window.innerWidth - largura - MARGEM),
      y: Math.min(Math.max(MARGEM, p.y), window.innerHeight - altura - MARGEM),
    };
  }, []);

  function aoPegar(evento: React.PointerEvent<HTMLDivElement>) {
    const caixa = alvo.current?.getBoundingClientRect();
    if (!caixa) return;

    moveu.current = false;
    inicio.current = { x: evento.clientX, y: evento.clientY, px: caixa.left, py: caixa.top };
    setArrastando(true);
    alvo.current?.setPointerCapture(evento.pointerId);
  }

  function aoMover(evento: React.PointerEvent<HTMLDivElement>) {
    if (!inicio.current) return;

    const dx = evento.clientX - inicio.current.x;
    const dy = evento.clientY - inicio.current.y;

    // abaixo de alguns pixels ainda é um toque, não um arrasto: sem esta folga,
    // tocar para voltar ao treino viraria um arrasto de dois pixels
    if (!moveu.current && Math.hypot(dx, dy) < 6) return;
    moveu.current = true;

    setArrastada(dentroDaTela({ x: inicio.current.px + dx, y: inicio.current.py + dy }));
  }

  function aoSoltar(evento: React.PointerEvent<HTMLDivElement>) {
    alvo.current?.releasePointerCapture(evento.pointerId);
    inicio.current = null;
    setArrastando(false);

    if (!moveu.current) {
      router.push('/treinar');
      return;
    }

    if (arrastada) {
      guardarPosicao(arrastada);
      setArrastada(null);
    }
  }

  if (naTelaDoTreino || !sessao) return null;

  const pausado = isPaused(sessao);
  const fracao = progressRatio(sessao, agora);
  const relogio = formatClock(displaySeconds(sessao, agora));

  const intervalo = preferencias.ligado ? preferencias.ultimo : null;
  const momento = intervalo
    ? momentoEm(intervalo, Math.floor(elapsedSeconds(sessao, agora)))
    : null;

  return (
    <div
      ref={alvo}
      role="button"
      tabIndex={0}
      aria-label={`Treino em andamento, ${relogio}. Toque para voltar ao cronômetro, arraste para mover`}
      onPointerDown={aoPegar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          router.push('/treinar');
        }
      }}
      style={
        posicao
          ? { left: posicao.x, top: posicao.y, right: 'auto', bottom: 'auto' }
          : undefined
      }
      className={cn(
        'fixed z-50 touch-none select-none',
        // canto padrão: acima da barra de baixo no celular
        !posicao && 'pb-safe right-4 bottom-20 lg:bottom-6',
        'bg-background/95 border-border flex cursor-grab items-center gap-2.5 rounded-full border py-2 pr-4 pl-2.5',
        'shadow-lg backdrop-blur',
        arrastando ? 'scale-105 cursor-grabbing shadow-xl' : 'transition-transform active:scale-95',
      )}
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center">
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
          {/* com o sino ligado, o que importa saber daqui é a fase — o relógio
              do treino já está logo acima */}
          {pausado
            ? 'pausado'
            : momento
              ? `${momento.fase === 'trabalho' ? 'esforço' : 'descanso'} · ${momento.restante}s`
              : 'treinando'}
        </span>
      </span>
    </div>
  );
}
