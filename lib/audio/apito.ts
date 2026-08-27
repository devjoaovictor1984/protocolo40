'use client';

import type { Sinal } from '@/services/intervals';

/**
 * O som dos intervalos.
 *
 * **Sintetizado, não gravado.** Um oscilador do Web Audio em vez de um arquivo
 * MP3, por quatro razões que se somam:
 *
 * 1. **Zero bytes.** O app é offline-first e todo arquivo entra no cache do
 *    aparelho de alguém. Um bipe não vale espaço.
 * 2. **Funciona sem rede desde o primeiro segundo**, sem depender de o cache
 *    ter sido preenchido antes.
 * 3. **Latência previsível.** Áudio agendado no relógio do próprio contexto,
 *    não no `setTimeout` do JavaScript — que atrasa quando a aba está ocupada.
 * 4. **Três sons distintos de graça**, e distinguir "vai" de "para" sem olhar
 *    para a tela é o ponto todo de existir som.
 *
 * ## O que trava, e como
 *
 * **Toda plataforma exige um gesto para liberar áudio.** Um `AudioContext`
 * criado fora de um toque nasce suspenso e nunca soa. Por isso `liberar()`
 * existe e precisa ser chamado de dentro do clique de começar o treino — não
 * antes, não depois.
 *
 * **No iPhone, a chavinha lateral de silencioso corta o Web Audio.** Não há API
 * para detectar nem para contornar; a tela precisa dizer isso em texto.
 *
 * **Com a tela apagada, o sistema suspende o app.** Quem resolve isso não é o
 * áudio, é o Wake Lock — está em `useIntervals`.
 */

type Nota = { hz: number; duracaoMs: number; atrasoMs: number; volume: number };

/**
 * O desenho de cada sinal.
 *
 * Agudo e duplo para começar, grave e longo para parar, curto e discreto para a
 * contagem. A diferença é de altura e de ritmo ao mesmo tempo: quem não
 * distingue bem frequência ainda distingue um toque de dois.
 */
const DESENHOS: Record<Exclude<Sinal, null>, Nota[]> = {
  comecar: [
    { hz: 880, duracaoMs: 110, atrasoMs: 0, volume: 0.5 },
    { hz: 1320, duracaoMs: 180, atrasoMs: 140, volume: 0.5 },
  ],
  parar: [{ hz: 330, duracaoMs: 420, atrasoMs: 0, volume: 0.45 }],
  contagem: [{ hz: 660, duracaoMs: 70, atrasoMs: 0, volume: 0.28 }],
};

let contexto: AudioContext | null = null;

/** O contexto já foi liberado por um gesto? */
export const audioLiberado = () => contexto?.state === 'running';

/**
 * Libera o áudio. **Precisa ser chamado de dentro de um gesto do usuário.**
 *
 * Toca uma nota inaudível no fim: em alguns navegadores o contexto só sai de
 * verdade do estado suspenso depois que algo é reproduzido.
 */
export async function liberar(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const Contexto =
      window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return false;

    contexto ??= new Contexto();
    if (contexto.state === 'suspended') await contexto.resume();

    const ganho = contexto.createGain();
    ganho.gain.value = 0.0001;
    ganho.connect(contexto.destination);

    const oscilador = contexto.createOscillator();
    oscilador.connect(ganho);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.01);

    return contexto.state === 'running';
  } catch {
    // navegador sem Web Audio, ou permissão negada: o treino segue em silêncio
    return false;
  }
}

/**
 * Toca um sinal.
 *
 * O envelope de volume não é enfeite: subir e descer o ganho em poucos
 * milissegundos evita o estalo que um oscilador ligado e desligado seco produz.
 */
export function tocar(sinal: Exclude<Sinal, null>): void {
  if (!contexto || contexto.state !== 'running') return;

  const agora = contexto.currentTime;

  for (const nota of DESENHOS[sinal]) {
    const inicio = agora + nota.atrasoMs / 1000;
    const fim = inicio + nota.duracaoMs / 1000;

    const ganho = contexto.createGain();
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(nota.volume, inicio + 0.012);
    ganho.gain.exponentialRampToValueAtTime(0.0001, fim);
    ganho.connect(contexto.destination);

    const oscilador = contexto.createOscillator();
    oscilador.type = 'sine';
    oscilador.frequency.value = nota.hz;
    oscilador.connect(ganho);
    oscilador.start(inicio);
    oscilador.stop(fim + 0.02);
  }
}

/**
 * Vibração, como companheira do som e não como substituta.
 *
 * Funciona no Android e é ignorada no iPhone, que não expõe a API para a web.
 * Serve para quem treina com fone tocando música alta — e para quem esqueceu o
 * telefone no silencioso.
 */
export function vibrar(sinal: Exclude<Sinal, null>): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

  const padroes: Record<Exclude<Sinal, null>, number | number[]> = {
    comecar: [90, 70, 160],
    parar: 320,
    contagem: 45,
  };

  try {
    navigator.vibrate(padroes[sinal]);
  } catch {
    // alguns navegadores exigem interação recente; falhar aqui não é problema
  }
}

/** Desliga o contexto. Chamado ao sair da tela do treino. */
export function encerrar(): void {
  void contexto?.close().catch(() => {});
  contexto = null;
}
