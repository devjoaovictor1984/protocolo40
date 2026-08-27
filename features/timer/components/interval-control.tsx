'use client';

import { Bell, BellOff, VolumeX } from 'lucide-react';

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { PRESETS, type ConfiguracaoDeIntervalo, type Momento } from '@/services/intervals';

/**
 * Ligar e escolher o intervalo, de dentro do treino.
 *
 * Fica numa gaveta e não na tela: durante o treino a tela tem uma função só,
 * que é mostrar o tempo. Escolher intervalo é decisão de antes, e quem já
 * escolheu não deve tropeçar nos controles com a mão suada.
 *
 * Quando ligado, a faixa mostra a fase e o que falta — e é isso que a pessoa
 * olha de relance quando olha.
 */
export function IntervalControl({
  config,
  momento,
  comSom,
  onEscolher,
}: {
  config: ConfiguracaoDeIntervalo | null;
  momento: Momento | null;
  comSom: boolean;
  onEscolher: (config: ConfiguracaoDeIntervalo | null) => void;
}) {
  if (config && momento) {
    return (
      <div
        className={cn(
          'flex w-full max-w-sm items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
          momento.fase === 'trabalho'
            ? 'border-primary/40 bg-primary/5'
            : 'border-border bg-muted/40',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wider uppercase opacity-70">
            {config.descanso === 0
              ? `Sino · minuto ${momento.ciclo}`
              : momento.fase === 'trabalho'
                ? `Esforço · volta ${momento.ciclo}`
                : `Descanso · volta ${momento.ciclo}`}
          </p>
          <p className="tnum text-2xl leading-tight font-extrabold">{momento.restante}s</p>
        </div>

        {!comSom ? (
          <span
            title="O aparelho está em silencioso ou o som não foi liberado"
            className="text-muted-foreground flex items-center gap-1 text-[11px]"
          >
            <VolumeX aria-hidden className="size-3.5" />
            sem som
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => onEscolher(null)}
          aria-label="Desligar o intervalo"
          className="text-muted-foreground hover:text-foreground flex min-h-11 min-w-11 items-center justify-center rounded-lg"
        >
          <BellOff aria-hidden className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <Drawer>
      <DrawerTrigger
        render={
          <button
            type="button"
            className="border-border hover:bg-muted text-muted-foreground flex min-h-11 w-full max-w-sm items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors"
          >
            <Bell aria-hidden className="size-4" />
            Ligar o sino do intervalo
          </button>
        }
      />

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Sino do intervalo</DrawerTitle>
          <DrawerDescription>
            O app avisa quando começar e quando parar, para você treinar sem olhar a tela.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-2 px-4 pb-6">
          {PRESETS.map((preset) => (
            <button
              key={preset.nome}
              type="button"
              onClick={() => onEscolher(preset.config)}
              className="border-border hover:bg-muted flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-xl border px-4 text-left transition-colors"
            >
              <span className="font-semibold">{preset.nome}</span>
              <span className="text-muted-foreground text-xs leading-snug">
                {preset.descricao}
              </span>
            </button>
          ))}

          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Dois toques agudos = comece. Um grave e longo = pare. Três curtos = está acabando. A
            tela fica acesa enquanto o sino estiver ligado. No iPhone, a chavinha de silencioso
            corta o som.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
