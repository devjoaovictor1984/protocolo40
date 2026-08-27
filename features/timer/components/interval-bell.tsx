'use client';

import { useEffect, useRef, useState } from 'react';

import { useSession } from '@/features/session/session-context';
import { useIntervalPrefs } from '@/features/timer/use-interval-prefs';
import { encerrar, tocar, vibrar } from '@/lib/audio/apito';
import { readSession } from '@/lib/offline/db';
import { elapsedSeconds, isPaused, type TimerSession } from '@/services/duration';
import { sinalEm } from '@/services/intervals';

/**
 * Quem realmente toca o sino.
 *
 * **Não desenha nada.** Existe só para tocar, e mora no layout porque é o único
 * lugar que a navegação não desmonta.
 *
 * A primeira versão vivia dentro da tela do cronômetro. Funcionava enquanto
 * ninguém saísse dali — e sair dali é o caso normal: a pessoa aproveita o
 * descanso para ver o histórico, o app troca de rota, o componente desmonta, o
 * contexto de áudio fecha e o som simplesmente para. O treino continuava (o
 * tempo vem do IndexedDB), mas o aviso não vinha mais. Voltando para o
 * cronômetro, o som ressuscitava — o que tornava o defeito ainda mais confuso.
 *
 * Aqui, o relógio é lido do banco local e o áudio nunca é fechado enquanto
 * houver treino. Fechar só acontece quando não há mais sessão.
 */

/** Passo de leitura. Meio segundo garante não perder a virada de nenhum segundo. */
const RITMO_MS = 500;

export function IntervalBell() {
  const { userId } = useSession();
  const { preferencias } = useIntervalPrefs();

  /**
   * `undefined` enquanto o IndexedDB não respondeu.
   *
   * A diferença entre "ainda não sei" e "não há treino" importa: ir do
   * cronômetro para o resto do app troca de grupo de rotas, e trocar de grupo
   * remonta o layout — logo, remonta este componente. Nascendo como `null`, o
   * efeito de baixo fecharia o áudio no primeiro quadro depois de cada
   * navegação, justo o defeito que este componente existe para consertar.
   */
  const [sessao, setSessao] = useState<TimerSession | null | undefined>(undefined);
  const ultimoSegundo = useRef(-1);

  /*
   * As preferências entram por ref para o disparo ler sempre o valor do
   * momento, sem reiniciar o ciclo de leitura a cada ajuste de volume. A
   * escrita acontece num efeito, e não durante a renderização: mexer em `ref`
   * enquanto o React renderiza é o tipo de atalho que funciona até o dia em que
   * uma renderização é descartada e o valor fica adiantado.
   */
  const prefsRef = useRef(preferencias);

  useEffect(() => {
    prefsRef.current = preferencias;
  }, [preferencias]);

  useEffect(() => {
    let vivo = true;

    const ler = async () => {
      try {
        const guardada = await readSession();
        if (!vivo) return;

        const minha = guardada && guardada.user_id === userId ? guardada : null;
        setSessao(minha);

        const prefs = prefsRef.current;
        if (!minha || !prefs.ligado || !prefs.ultimo || isPaused(minha)) {
          ultimoSegundo.current = -1;
          return;
        }

        const segundo = Math.floor(elapsedSeconds(minha, Date.now()));
        if (segundo === ultimoSegundo.current) return;

        // saltou vários segundos: o app estava em segundo plano. Os avisos que
        // ficaram para trás não significam mais nada, então só se assume o
        // novo ponto
        const saltou = ultimoSegundo.current >= 0 && segundo - ultimoSegundo.current > 1;
        ultimoSegundo.current = segundo;
        if (saltou) return;

        const sinal = sinalEm(prefs.ultimo, segundo);
        if (!sinal) return;

        tocar(sinal, prefs);
        vibrar(sinal, prefs.vibrar);
      } catch {
        // sem IndexedDB não há treino a acompanhar
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
  }, [userId]);

  /**
   * Mantém a tela acesa enquanto o treino corre com sino.
   *
   * Vale em qualquer tela do app, e não só no cronômetro: quem está lendo o
   * histórico durante o descanso também precisa que o telefone não durma, ou o
   * próximo aviso não sai.
   */
  useEffect(() => {
    const ativo = Boolean(sessao) && preferencias.ligado;
    if (!ativo || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let trava: WakeLockSentinel | null = null;
    let vivo = true;

    const pedir = async () => {
      try {
        trava = await navigator.wakeLock.request('screen');
      } catch {
        // negado: o treino segue, só com a tela apagando
      }
    };

    void pedir();

    const aoVoltar = () => {
      if (vivo && document.visibilityState === 'visible') void pedir();
    };
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', aoVoltar);
      void trava?.release().catch(() => {});
    };
  }, [sessao, preferencias.ligado]);

  // sem treino, o contexto de áudio não precisa continuar de pé
  useEffect(() => {
    if (sessao === null) encerrar();
  }, [sessao]);

  return null;
}
