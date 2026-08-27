'use client';

import { useState } from 'react';
import { Bell, BellOff, Play, VolumeX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { liberar, tocar, vibrar, type Timbre, type Volume } from '@/lib/audio/apito';
import type { PreferenciasDoSino } from '@/features/timer/use-interval-prefs';
import { cn } from '@/lib/utils';
import {
  PRESETS,
  nomeDoIntervalo,
  normalizarConfig,
  type ConfiguracaoDeIntervalo,
  type Momento,
} from '@/services/intervals';

const VOLUMES: { valor: Volume; rotulo: string }[] = [
  { valor: 'baixo', rotulo: 'Baixo' },
  { valor: 'medio', rotulo: 'Médio' },
  { valor: 'alto', rotulo: 'Alto' },
];

const TIMBRES: { valor: Timbre; rotulo: string; descricao: string }[] = [
  { valor: 'campainha', rotulo: 'Campainha', descricao: 'Ressoa. O mais fácil de reconhecer.' },
  { valor: 'apito', rotulo: 'Apito', descricao: 'Corta ruído. Bom com música alta.' },
  { valor: 'bipe', rotulo: 'Bipe', descricao: 'Discreto, sem cauda.' },
];

/**
 * Ligar, escolher e ajustar o sino, de dentro do treino.
 *
 * Fica numa gaveta e não na tela: durante o treino a tela tem uma função só,
 * que é mostrar o tempo. Configurar é decisão de antes, e quem já escolheu não
 * deve tropeçar em controle com a mão suada.
 *
 * Todo ajuste toca uma amostra na hora. Escolher volume e timbre sem ouvir
 * seria escolher no escuro — e o único jeito de saber se "alto" basta no seu
 * fone é ouvir "alto" no seu fone.
 */
export function IntervalControl({
  config,
  momento,
  comSom,
  preferencias,
  onEscolher,
  onPreferencias,
}: {
  config: ConfiguracaoDeIntervalo | null;
  momento: Momento | null;
  comSom: boolean;
  preferencias: PreferenciasDoSino;
  onEscolher: (config: ConfiguracaoDeIntervalo | null) => void;
  onPreferencias: (mudanca: Partial<PreferenciasDoSino>) => void;
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
            {preferencias.ultimo
              ? `Ligar o sino · ${nomeDoIntervalo(preferencias.ultimo)}`
              : 'Ligar o sino do intervalo'}
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

        <div className="flex max-h-[70dvh] flex-col gap-5 overflow-y-auto px-4 pb-8">
          <Ajustes preferencias={preferencias} onPreferencias={onPreferencias} />

          <section className="flex flex-col gap-2">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Prontos
            </p>
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
          </section>

          <NoSeuJeito onEscolher={onEscolher} ultimo={preferencias.ultimo} />

          <p className="text-muted-foreground text-xs leading-relaxed">
            Dois toques subindo = comece. Um grave e longo = pare. Três curtos = está acabando. A
            tela fica acesa enquanto o sino estiver ligado. No iPhone, a chavinha de silencioso
            corta o som.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Volume, timbre e vibração — cada toque toca uma amostra. */
function Ajustes({
  preferencias,
  onPreferencias,
}: {
  preferencias: PreferenciasDoSino;
  onPreferencias: (mudanca: Partial<PreferenciasDoSino>) => void;
}) {
  async function provar(mudanca: Partial<PreferenciasDoSino>) {
    onPreferencias(mudanca);
    await liberar();
    const atual = { ...preferencias, ...mudanca };
    tocar('comecar', atual);
    vibrar('comecar', atual.vibrar);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Som
        </p>
        <div className="flex flex-col gap-2">
          {TIMBRES.map((timbre) => (
            <button
              key={timbre.valor}
              type="button"
              onClick={() => void provar({ timbre: timbre.valor })}
              className={cn(
                'flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left transition-colors',
                preferencias.timbre === timbre.valor
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted',
              )}
            >
              <Play aria-hidden className="size-4 shrink-0 opacity-60" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{timbre.rotulo}</span>
                <span className="text-muted-foreground block text-xs">{timbre.descricao}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Volume
        </p>
        <div className="flex gap-2">
          {VOLUMES.map((volume) => (
            <button
              key={volume.valor}
              type="button"
              onClick={() => void provar({ volume: volume.valor })}
              className={cn(
                'min-h-11 flex-1 rounded-lg border text-sm font-medium transition-colors',
                preferencias.volume === volume.valor
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted',
              )}
            >
              {volume.rotulo}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={preferencias.vibrar}
          onChange={(evento) => void provar({ vibrar: evento.target.checked })}
          className="accent-primary size-5"
        />
        Vibrar junto
        <span className="text-muted-foreground text-xs">(o iPhone não vibra pela web)</span>
      </label>
    </section>
  );
}

/** Os segundos digitados à mão, para quem não cabe em preset. */
function NoSeuJeito({
  ultimo,
  onEscolher,
}: {
  ultimo: ConfiguracaoDeIntervalo | null;
  onEscolher: (config: ConfiguracaoDeIntervalo) => void;
}) {
  const [trabalho, setTrabalho] = useState(String(ultimo?.trabalho ?? 45));
  const [descanso, setDescanso] = useState(String(ultimo?.descanso ?? 15));
  const [erro, setErro] = useState<string | null>(null);

  return (
    <section className="border-border flex flex-col gap-3 rounded-xl border p-4">
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        Do seu jeito
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sino-trabalho">Esforço (s)</Label>
          <Input
            id="sino-trabalho"
            type="number"
            inputMode="numeric"
            min={5}
            max={600}
            value={trabalho}
            onChange={(e) => setTrabalho(e.target.value)}
            className="tnum h-12"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sino-descanso">Descanso (s)</Label>
          <Input
            id="sino-descanso"
            type="number"
            inputMode="numeric"
            min={0}
            max={600}
            value={descanso}
            onChange={(e) => setDescanso(e.target.value)}
            className="tnum h-12"
          />
        </div>
      </div>

      {erro ? (
        <p role="alert" className="text-destructive text-xs">
          {erro}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">Descanso zero vira um sino a cada intervalo.</p>
      )}

      <Button
        type="button"
        className="h-12"
        onClick={() => {
          const resultado = normalizarConfig(trabalho, descanso);
          if (!resultado.ok) {
            setErro(resultado.erro);
            return;
          }
          setErro(null);
          onEscolher(resultado.config);
        }}
      >
        Usar este intervalo
      </Button>
    </section>
  );
}
