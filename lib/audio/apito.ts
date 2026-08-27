'use client';

import type { Sinal } from '@/services/intervals';

/**
 * O som dos intervalos.
 *
 * **Sintetizado, não gravado.** Osciladores do Web Audio em vez de arquivos, por
 * quatro razões que se somam: zero bytes num app offline-first; funciona sem
 * rede desde o primeiro segundo; latência do relógio do áudio em vez do
 * `setTimeout`; e timbres distintos de graça.
 *
 * ## O que faz um som ser reconhecido
 *
 * A primeira versão daqui tinha bipes de 110 ms e não servia. **Abaixo de uns
 * 150 ms o ouvido registra um clique, não um som identificável** — e quem está
 * ofegante no meio de um burpee precisa reconhecer o sinal sem pensar. Todos os
 * sinais de virada agora passam de meio segundo.
 *
 * **Campainha não é um oscilador.** Um sino tem parciais *inarmônicos* — as
 * frequências que ele produz não são múltiplos inteiros da fundamental, e é
 * isso que separa "sino" de "bipe". Cada timbre aqui é somado de vários
 * osciladores com essas proporções, ataque seco e cauda longa.
 *
 * **O compressor no fim é o que permite ser alto.** Sem ele, subir o ganho
 * distorce; com ele, os picos são contidos e o som fica mais presente sem
 * estalar.
 *
 * ## O que trava, e como
 *
 * **Toda plataforma exige um gesto para liberar áudio.** Um `AudioContext`
 * criado fora de um toque nasce suspenso e nunca soa — daí `liberar()`.
 *
 * **No iPhone, a chavinha lateral de silencioso corta o Web Audio.** Não há API
 * para detectar nem contornar; a tela precisa dizer isso em texto.
 *
 * **Com a tela apagada o sistema suspende o app.** Quem resolve é o Wake Lock,
 * em `useIntervals`.
 */

/** Um golpe: fundamental, quando toca, quanto dura e quão forte. */
type Golpe = { hz: number; atrasoMs: number; duracaoMs: number; volume: number };

/**
 * O quanto o som se impõe.
 *
 * Faz diferença real: quem treina de fone com música alta precisa de "alto";
 * quem treina de madrugada com a casa dormindo precisa de "baixo". Sem essa
 * escolha, os dois desligam o recurso.
 */
export type Volume = 'baixo' | 'medio' | 'alto';

const GANHO: Record<Volume, number> = { baixo: 0.35, medio: 0.85, alto: 1.6 };

/**
 * O caráter do som.
 *
 * O que **não** muda com o timbre é o significado: dois toques subindo
 * continuam sendo "comece" e um grave e longo continua sendo "pare". Deixar
 * trocar isso seria deixar a pessoa montar uma armadilha para si mesma no meio
 * do treino.
 */
export type Timbre = 'campainha' | 'apito' | 'bipe';

/**
 * A receita de cada timbre.
 *
 * `parciais` são as proporções em relação à fundamental. Números inteiros dão
 * um som de instrumento; os quebrados são o que faz soar como metal batido.
 * `decaimento` multiplica a cauda — sino ressoa, apito corta.
 */
const TIMBRES: Record<
  Timbre,
  { onda: OscillatorType; parciais: { razao: number; peso: number }[]; decaimento: number }
> = {
  // proporções aproximadas de um sino real: fundamental, oitava, e os
  // inarmônicos que dão o "metal"
  campainha: {
    onda: 'sine',
    parciais: [
      { razao: 1, peso: 1 },
      { razao: 2.0, peso: 0.6 },
      { razao: 2.76, peso: 0.42 },
      { razao: 5.4, peso: 0.22 },
      { razao: 8.9, peso: 0.12 },
    ],
    decaimento: 1.6,
  },
  // apito de árbitro: fundamental forte com uma quinta acima, som que corta
  apito: {
    onda: 'square',
    parciais: [
      { razao: 1, peso: 0.5 },
      { razao: 1.5, peso: 0.35 },
    ],
    decaimento: 0.9,
  },
  // digital, discreto, sem ressonância
  bipe: {
    onda: 'sine',
    parciais: [{ razao: 1, peso: 1 }],
    decaimento: 0.7,
  },
};

export type Preferencias = { volume: Volume; timbre: Timbre; vibrar: boolean };

export const PREFERENCIAS_PADRAO: Preferencias = {
  volume: 'medio',
  timbre: 'campainha',
  vibrar: true,
};

/**
 * O desenho de cada sinal.
 *
 * Duas dimensões separam os três, e de propósito: **altura e ritmo**. Quem não
 * distingue bem frequência ainda distingue um toque de dois, e quem ouve mal
 * agudos ainda percebe a duração.
 *
 * Nenhuma virada dura menos de 600 ms no total.
 */
const DESENHOS: Record<Exclude<Sinal, null>, Golpe[]> = {
  // duas notas subindo: o movimento ascendente é lido como "vai"
  comecar: [
    { hz: 784, atrasoMs: 0, duracaoMs: 300, volume: 0.55 },
    { hz: 1175, atrasoMs: 190, duracaoMs: 620, volume: 0.6 },
  ],
  // uma nota grave e longa: pesa, e por isso é lida como "para"
  parar: [{ hz: 294, atrasoMs: 0, duracaoMs: 900, volume: 0.6 }],
  // curto de propósito — é aviso, não ordem —, mas acima do limiar do clique
  contagem: [{ hz: 587, atrasoMs: 0, duracaoMs: 160, volume: 0.3 }],
};

let contexto: AudioContext | null = null;
let saida: DynamicsCompressorNode | null = null;

/** O contexto já foi liberado por um gesto? */
export const audioLiberado = () => contexto?.state === 'running';

/**
 * Libera o áudio. **Precisa ser chamado de dentro de um gesto do usuário.**
 *
 * Reproduz uma nota inaudível no fim: em alguns navegadores o contexto só sai
 * mesmo do estado suspenso depois que algo tocou.
 */
export async function liberar(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const Contexto =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return false;

    contexto ??= new Contexto();
    if (contexto.state === 'suspended') await contexto.resume();

    if (!saida) {
      // o limitador é o que deixa "alto" ser alto sem distorcer: ele segura os
      // picos em vez de deixar o sinal estourar
      saida = contexto.createDynamicsCompressor();
      saida.threshold.value = -12;
      saida.knee.value = 6;
      saida.ratio.value = 12;
      saida.attack.value = 0.002;
      saida.release.value = 0.18;
      saida.connect(contexto.destination);
    }

    const mudo = contexto.createGain();
    mudo.gain.value = 0.0001;
    mudo.connect(contexto.destination);

    const oscilador = contexto.createOscillator();
    oscilador.connect(mudo);
    oscilador.start();
    oscilador.stop(contexto.currentTime + 0.01);

    return contexto.state === 'running';
  } catch {
    // navegador sem Web Audio: o treino segue em silêncio
    return false;
  }
}

/**
 * Toca um sinal.
 *
 * O ataque de 4 ms e a queda exponencial não são enfeite: ligar e desligar um
 * oscilador seco produz um estalo, e a curva exponencial é o que soa como algo
 * ressoando em vez de um volume sendo abaixado.
 */
export function tocar(
  sinal: Exclude<Sinal, null>,
  preferencias: Preferencias = PREFERENCIAS_PADRAO,
): void {
  if (!contexto || !saida || contexto.state !== 'running') return;

  const receita = TIMBRES[preferencias.timbre] ?? TIMBRES.campainha;
  const escala = GANHO[preferencias.volume] ?? GANHO.medio;
  const agora = contexto.currentTime;

  for (const golpe of DESENHOS[sinal]) {
    const inicio = agora + golpe.atrasoMs / 1000;
    const fim = inicio + (golpe.duracaoMs * receita.decaimento) / 1000;

    for (const parcial of receita.parciais) {
      const pico = Math.min(0.9, golpe.volume * escala * parcial.peso);
      if (pico < 0.001) continue;

      const ganho = contexto.createGain();
      ganho.gain.setValueAtTime(0.0001, inicio);
      ganho.gain.exponentialRampToValueAtTime(pico, inicio + 0.004);
      // os parciais agudos morrem antes, como num sino de verdade
      ganho.gain.exponentialRampToValueAtTime(
        0.0001,
        inicio + (fim - inicio) / Math.max(1, parcial.razao * 0.45),
      );
      ganho.connect(saida);

      const oscilador = contexto.createOscillator();
      oscilador.type = receita.onda;
      oscilador.frequency.value = golpe.hz * parcial.razao;
      oscilador.connect(ganho);
      oscilador.start(inicio);
      oscilador.stop(fim + 0.05);
    }
  }
}

/**
 * Vibração, companheira do som e não substituta.
 *
 * Funciona no Android e é ignorada no iPhone, que não expõe a API para a web.
 * Serve para quem treina de fone com música alta — e para quem esqueceu o
 * telefone no silencioso.
 */
export function vibrar(sinal: Exclude<Sinal, null>, ligado = true): void {
  if (!ligado || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

  const padroes: Record<Exclude<Sinal, null>, number | number[]> = {
    comecar: [120, 80, 220],
    parar: 450,
    contagem: 60,
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
  saida = null;
}
