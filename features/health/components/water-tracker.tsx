'use client';

import { useState } from 'react';
import { Droplet, Loader2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Água do dia.
 *
 * Um toque por copo. A soma acontece no banco, com upsert, porque dois toques
 * rápidos em `select` + `update` perderiam um dos dois — e é exatamente assim
 * que se registra água: vários toques seguidos.
 *
 * O número na tela sobe na hora e volta atrás se o servidor recusar.
 */

const COPOS = [
  { ml: 200, rotulo: 'Copo' },
  { ml: 300, rotulo: 'Caneca' },
  { ml: 500, rotulo: 'Garrafa' },
  { ml: 1000, rotulo: 'Garrafão' },
] as const;

export function WaterTracker({
  dia,
  inicial,
  meta,
}: {
  dia: string;
  inicial: number;
  meta: number | null;
}) {
  const [ml, setMl] = useState(inicial);
  const [salvando, setSalvando] = useState(false);

  const percentual = meta && meta > 0 ? Math.min(100, Math.round((ml / meta) * 100)) : null;
  const bateu = meta !== null && ml >= meta;

  async function somar(quantidade: number) {
    const anterior = ml;
    const otimista = Math.max(0, ml + quantidade);

    setMl(otimista);
    setSalvando(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('somar_agua', { p_day: dia, p_ml: quantidade });

      if (error) throw error;
      if (typeof data === 'number') setMl(data);
    } catch {
      setMl(anterior);
      toast.error('Não conseguimos registrar agora.', {
        description: 'Confira a conexão e toque de novo.',
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section className="border-border flex flex-col gap-4 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <Droplet aria-hidden className="text-primary size-4" />
            Água de hoje
          </h2>
          <p className="text-muted-foreground tnum mt-0.5 flex items-center gap-1.5 text-sm">
            {(ml / 1000).toFixed(1).replace('.', ',')} L
            {meta !== null ? ` de ${(meta / 1000).toFixed(1).replace('.', ',')} L` : ''}
            {/* enquanto não confirmou, o número é uma promessa: dizer isso evita
                que alguém feche o app achando que já está guardado */}
            {salvando ? (
              <Loader2 aria-label="Salvando" className="size-3 shrink-0 animate-spin" />
            ) : null}
          </p>
        </div>

        {percentual !== null ? (
          <span
            className={cn(
              'tnum shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
              bateu ? 'border-success/40 text-success' : 'border-border text-muted-foreground',
            )}
          >
            {bateu ? 'meta batida' : `${percentual}%`}
          </span>
        ) : null}
      </div>

      {percentual !== null ? (
        <div
          role="progressbar"
          aria-valuenow={ml}
          aria-valuemin={0}
          aria-valuemax={meta ?? undefined}
          aria-label="Água bebida hoje"
          className="bg-secondary h-2.5 w-full overflow-hidden rounded-full"
        >
          <div
            className={cn('h-full rounded-full transition-all', bateu ? 'bg-success' : 'bg-primary')}
            style={{ width: `${percentual}%` }}
          />
        </div>
      ) : null}

      <div className="flex gap-2">
        {COPOS.map((copo) => (
          <Button
            key={copo.ml}
            variant="outline"
            className="h-14 flex-1 flex-col gap-0.5"
            disabled={salvando}
            onClick={() => void somar(copo.ml)}
          >
            <span className="flex items-center gap-1 text-sm font-semibold">
              <Plus aria-hidden className="size-3" />
              {copo.ml >= 1000 ? '1 L' : `${copo.ml} ml`}
            </span>
            <span className="text-muted-foreground text-[11px]">{copo.rotulo}</span>
          </Button>
        ))}

        <Button
          variant="ghost"
          size="icon"
          className="h-14 w-12"
          aria-label="Tirar 200 ml"
          disabled={salvando || ml === 0}
          onClick={() => void somar(-200)}
        >
          <Minus aria-hidden className="size-4" />
        </Button>
      </div>
    </section>
  );
}
