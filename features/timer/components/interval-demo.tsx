'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Pause, Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  PREFERENCIAS_PADRAO,
  liberar,
  tocar,
  vibrar,
  type Timbre,
  type Volume,
} from '@/lib/audio/apito';
import { cn } from '@/lib/utils';
import {
  PRESETS,
  duracaoDoCiclo,
  linhaDoTempo,
  momentoEm,
  sinalEm,
  type ConfiguracaoDeIntervalo,
} from '@/services/intervals';

/**
 * Demonstração dos intervalos, para gravar em vídeo.
 *
 * Duas coisas que a tela do treino não faz e aqui são essenciais:
 *
 * 1. **Velocidade acelerada.** Mostrar um ciclo de 60/60 em tempo real leva dois
 *    minutos de vídeo em que nada acontece. A 4× cabe em trinta segundos e o
 *    som continua na ordem certa.
 * 2. **A linha do tempo desenhada.** Quem assiste vê *quando* cada sinal vai
 *    tocar antes de ele tocar — é o que transforma "apitou" em "entendi a
 *    regra".
 *
 * Cada bipe também pode ser tocado à mão, para gravar os três sons separados e
 * explicar um por um.
 */
export function IntervalDemo() {
  const [config, setConfig] = useState<ConfiguracaoDeIntervalo>(PRESETS[2].config);
  const [velocidade, setVelocidade] = useState(4);
  const [segundo, setSegundo] = useState(0);
  const [rodando, setRodando] = useState(false);
  const [comSom, setComSom] = useState(false);
  const [timbre, setTimbre] = useState<Timbre>(PREFERENCIAS_PADRAO.timbre);
  const [volume, setVolume] = useState<Volume>('alto');
  const preferencias = { timbre, volume, vibrar: true };

  const ultimo = useRef(-1);
  const ciclo = duracaoDoCiclo(config);
  const total = ciclo * 2;
  const momento = momentoEm(config, segundo);
  const linha = linhaDoTempo(config, total);

  useEffect(() => {
    if (!rodando) return;

    const id = window.setInterval(() => {
      setSegundo((atual) => (atual + 1 > total ? 0 : atual + 1));
    }, 1000 / velocidade);

    return () => window.clearInterval(id);
  }, [rodando, velocidade, total]);

  useEffect(() => {
    if (!rodando || segundo === ultimo.current) return;
    ultimo.current = segundo;

    const sinal = sinalEm(config, segundo);
    if (!sinal) return;

    tocar(sinal, preferencias);
    vibrar(sinal);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- as preferências são lidas no disparo, não observadas
  }, [config, rodando, segundo]);

  async function alternar() {
    if (!rodando && !comSom) {
      // o áudio só libera de dentro de um gesto; este é o gesto
      setComSom(await liberar());
    }
    setRodando((atual) => !atual);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const igual =
            preset.config.trabalho === config.trabalho && preset.config.descanso === config.descanso;

          return (
            <button
              key={preset.nome}
              type="button"
              onClick={() => {
                setConfig(preset.config);
                setSegundo(0);
                ultimo.current = -1;
              }}
              className={cn(
                'min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors',
                igual ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
              )}
            >
              {preset.nome}
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          'flex flex-col items-center gap-1 rounded-2xl border p-8 transition-colors',
          momento.fase === 'trabalho'
            ? 'border-primary/40 bg-primary/5'
            : 'border-border bg-muted/40',
        )}
      >
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          {config.descanso === 0
            ? `Minuto ${momento.ciclo}`
            : momento.fase === 'trabalho'
              ? `Esforço · volta ${momento.ciclo}`
              : `Descanso · volta ${momento.ciclo}`}
        </p>

        <p className="tnum text-6xl font-extrabold tracking-tighter">{momento.restante}</p>

        <p className="text-muted-foreground tnum text-sm">
          {segundo}s de {total}s
        </p>
      </div>

      {/* a régua: cada marca é um som, e a agulha mostra onde estamos */}
      <div className="flex flex-col gap-1.5">
        <div className="bg-muted relative h-10 w-full overflow-hidden rounded-lg">
          {linha.map((marca) => (
            <span
              key={`${marca.segundo}-${marca.sinal}`}
              title={`${marca.segundo}s — ${marca.sinal}`}
              style={{ left: `${(marca.segundo / total) * 100}%` }}
              className={cn(
                'absolute top-0 h-full w-[3px] -translate-x-1/2',
                marca.sinal === 'comecar' && 'bg-primary',
                marca.sinal === 'parar' && 'bg-foreground/60',
                marca.sinal === 'contagem' && 'bg-muted-foreground/40',
              )}
            />
          ))}

          <span
            aria-hidden
            style={{ left: `${(segundo / total) * 100}%` }}
            className="bg-destructive absolute top-0 h-full w-[2px] -translate-x-1/2 transition-[left] duration-200"
          />
        </div>

        <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="bg-primary inline-block h-3 w-[3px]" /> começar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-foreground/60 inline-block h-3 w-[3px]" /> parar
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-muted-foreground/40 inline-block h-3 w-[3px]" /> aviso de 3s
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={alternar} className="h-12 flex-1 font-semibold">
          {rodando ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          {rodando ? 'PAUSAR' : 'RODAR'}
        </Button>

        <Button
          variant="outline"
          className="h-12"
          onClick={() => {
            setSegundo(0);
            ultimo.current = -1;
          }}
        >
          <RotateCcw aria-hidden className="size-4" />
        </Button>

        <div className="flex gap-1">
          {[1, 2, 4, 8].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVelocidade(v)}
              className={cn(
                'min-h-11 min-w-11 rounded-lg border text-sm font-medium',
                velocidade === v
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted',
              )}
            >
              {v}×
            </button>
          ))}
        </div>
      </div>

      {/* os mesmos ajustes que o usuário tem: o vídeo precisa mostrar o app,
          não uma versão simplificada dele */}
      <div className="flex flex-wrap items-center gap-2">
        {(['campainha', 'apito', 'bipe'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={async () => {
              setTimbre(t);
              if (!comSom) setComSom(await liberar());
              tocar('comecar', { timbre: t, volume, vibrar: false });
            }}
            className={cn(
              'min-h-11 rounded-lg border px-3 text-sm font-medium capitalize transition-colors',
              timbre === t ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
            )}
          >
            {t}
          </button>
        ))}

        <span className="text-muted-foreground px-1 text-xs">volume</span>
        {(['baixo', 'medio', 'alto'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={async () => {
              setVolume(v);
              if (!comSom) setComSom(await liberar());
              tocar('comecar', { timbre, volume: v, vibrar: false });
            }}
            className={cn(
              'min-h-11 rounded-lg border px-3 text-sm font-medium capitalize transition-colors',
              volume === v ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted',
            )}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Tocar cada som separado
        </p>
        <div className="flex flex-wrap gap-2">
          {(['comecar', 'parar', 'contagem'] as const).map((sinal) => (
            <Button
              key={sinal}
              variant="outline"
              className="h-11"
              onClick={async () => {
                if (!comSom) setComSom(await liberar());
                tocar(sinal, preferencias);
                vibrar(sinal);
              }}
            >
              <Bell aria-hidden className="size-4" />
              {sinal === 'comecar' ? 'Começar' : sinal === 'parar' ? 'Parar' : 'Aviso'}
            </Button>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
        {comSom ? (
          <Volume2 aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
        ) : (
          <VolumeX aria-hidden className="mt-0.5 size-4 shrink-0" />
        )}
        {comSom
          ? 'Som liberado neste aparelho. No iPhone, a chavinha lateral de silencioso corta o áudio da web — não há como detectar nem contornar, então vale avisar no vídeo.'
          : 'O som só é liberado depois de um toque seu: toda plataforma exige um gesto. Use RODAR ou um dos botões de som abaixo.'}
      </p>
    </div>
  );
}
