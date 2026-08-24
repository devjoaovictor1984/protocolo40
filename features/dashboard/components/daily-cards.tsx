'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Droplet, Loader2, Minus, Scale } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { localMeasurements, saveMeasurement } from '@/features/measurements/repository';
import { useSession, useToday } from '@/features/session/session-context';
import { recarregar } from '@/lib/query/refresh';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

/**
 * Peso e água, lado a lado no dia.
 *
 * São as duas coisas que se registram todo dia além do treino, e as duas
 * levavam a telas diferentes. Aqui cabem numa grade de dois: o peso pede um
 * número e some quando registrado; a água é toque em cima de toque, então
 * fica sempre aberta, mostrando quanto já foi.
 */
/**
 * As medidas de copo.
 *
 * Quatro cobrem o que as pessoas realmente usam: copo, caneca, garrafinha e
 * garrafão. Mais opções virariam uma escolha antes de um gesto que deveria ser
 * automático.
 */
const MEDIDAS = [
  { ml: 200, curto: '200' },
  { ml: 300, curto: '300' },
  { ml: 500, curto: '500' },
  { ml: 1000, curto: '1 L' },
] as const;

export function DailyCards({ aguaInicial, metaAgua }: { aguaInicial: number; metaAgua: number | null }) {
  return (
    <section aria-label="Seu dia" className="grid grid-cols-2 gap-3">
      <CartaoPeso />
      <CartaoAgua inicial={aguaInicial} meta={metaAgua} />
    </section>
  );
}

function Moldura({
  titulo,
  icone: Icone,
  concluido,
  children,
  href,
}: {
  titulo: string;
  icone: typeof Scale;
  concluido?: boolean;
  children: React.ReactNode;
  href?: string;
}) {
  const cabecalho = (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full',
          concluido ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground',
        )}
      >
        {concluido ? (
          <Check aria-hidden className="size-3.5" />
        ) : (
          <Icone aria-hidden className="size-3.5" />
        )}
      </span>
      <span className="truncate text-[11px] font-semibold tracking-wider uppercase">{titulo}</span>
    </div>
  );

  return (
    <div className="border-border bg-card flex min-w-0 flex-col gap-3 rounded-2xl border p-3">
      {href ? (
        <Link href={href} className="hover:text-foreground text-muted-foreground">
          {cabecalho}
        </Link>
      ) : (
        cabecalho
      )}
      {children}
    </div>
  );
}

function CartaoPeso() {
  const { userId } = useSession();
  const today = useToday();
  const queryClient = useQueryClient();

  const [valor, setValor] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: medidas, isLoading } = useQuery({
    queryKey: ['measurements', userId],
    queryFn: () => localMeasurements(userId),
    staleTime: 10_000,
  });

  const deHoje = (medidas ?? []).find((item) => item.measured_on === today);
  const ultimo = (medidas ?? []).find((item) => item.weight_kg !== null);

  // parte do último peso: ele muda pouco de um dia para o outro
  const preenchido =
    valor ?? (ultimo?.weight_kg ? ultimo.weight_kg.toFixed(1).replace('.', ',') : '');

  async function registrar() {
    const peso = Number(preenchido.replace(',', '.'));

    if (!Number.isFinite(peso) || peso < 20 || peso > 400) {
      toast.error('Informe um peso entre 20 e 400 kg.');
      return;
    }

    setSalvando(true);

    try {
      await saveMeasurement({ userId, measuredOn: today, weightKg: peso });
      await recarregar(queryClient, ['measurements'], ['sync', 'queue']);
      setValor(null);
      toast.success('Peso registrado.');
    } catch {
      toast.error('Não conseguimos salvar agora.', { description: 'Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) {
    return (
      <Moldura titulo="Peso" icone={Scale}>
        <div className="bg-muted h-9 animate-pulse rounded-lg" />
      </Moldura>
    );
  }

  if (deHoje?.weight_kg) {
    return (
      <Moldura titulo="Peso" icone={Scale} concluido href="/medidas">
        <p className="tnum text-2xl font-extrabold">
          {deHoje.weight_kg.toFixed(1).replace('.', ',')}
          <span className="text-muted-foreground ml-1 text-sm font-normal">kg</span>
        </p>
        <Link
          href="/medidas"
          className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-4"
        >
          Ver histórico
        </Link>
      </Moldura>
    );
  }

  return (
    <Moldura titulo="Peso" icone={Scale}>
      <div className="flex gap-1.5">
        {/* text + inputMode: o campo numérico do HTML recusa "86,4" */}
        <Input
          type="text"
          inputMode="decimal"
          value={preenchido}
          onChange={(event) => setValor(event.target.value)}
          aria-label="Peso de hoje em quilos"
          placeholder="86,4"
          className="tnum h-10 min-w-0 flex-1 text-base"
        />
        <Button
          size="icon"
          className="size-10 shrink-0"
          aria-label="Registrar peso de hoje"
          disabled={salvando || !preenchido}
          onClick={() => void registrar()}
        >
          {salvando ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Check aria-hidden className="size-4" />
          )}
        </Button>
      </div>
    </Moldura>
  );
}

/**
 * Água do dia, em versão compacta.
 *
 * A soma acontece no banco, com upsert: dois toques rápidos em `select` +
 * `update` perderiam um, e é exatamente assim que se registra água.
 */
function CartaoAgua({ inicial, meta }: { inicial: number; meta: number | null }) {
  const today = useToday();
  const [ml, setMl] = useState(inicial);
  const [salvando, setSalvando] = useState(false);

  const percentual = meta && meta > 0 ? Math.min(100, Math.round((ml / meta) * 100)) : null;
  const bateu = meta !== null && ml >= meta;

  async function somar(quantidade: number) {
    const anterior = ml;
    setMl(Math.max(0, ml + quantidade));
    setSalvando(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('somar_agua', { p_day: today, p_ml: quantidade });

      if (error) throw error;
      if (typeof data === 'number') setMl(data);
    } catch {
      setMl(anterior);
      toast.error('Não conseguimos registrar agora.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Moldura titulo="Água" icone={Droplet} concluido={bateu} href="/saude">
      <div>
        <p className="tnum flex items-center gap-1.5 text-2xl font-extrabold">
          {(ml / 1000).toFixed(1).replace('.', ',')}
          <span className="text-muted-foreground text-sm font-normal">
            {meta ? `de ${(meta / 1000).toFixed(1).replace('.', ',')} L` : 'L'}
          </span>
          {salvando ? <Loader2 aria-label="Salvando" className="size-3 animate-spin" /> : null}
        </p>

        {/* bater a meta merece a mesma confirmação que o peso registrado tem:
            um estado de "pronto", e não só uma barra cheia */}
        {bateu ? (
          <p className="text-success mt-0.5 flex items-center gap-1 text-[11px] font-semibold">
            <Check aria-hidden className="size-3" />
            Meta batida
          </p>
        ) : null}

        {percentual !== null ? (
          <div
            role="progressbar"
            aria-valuenow={ml}
            aria-valuemin={0}
            aria-valuemax={meta ?? undefined}
            aria-label="Água bebida hoje"
            className="bg-secondary mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
          >
            <div
              className={cn('h-full rounded-full', bateu ? 'bg-success' : 'bg-primary')}
              style={{ width: `${percentual}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        {/* quatro medidas: copo, caneca, garrafa e garrafão. Rótulo curto
            porque o cartão tem metade da tela no celular. */}
        <div className="grid grid-cols-4 gap-1">
          {MEDIDAS.map((medida) => (
            <Button
              key={medida.ml}
              size="sm"
              className="h-9 px-0 text-[11px] font-semibold"
              aria-label={`Somar ${medida.ml} ml`}
              disabled={salvando}
              onClick={() => void somar(medida.ml)}
            >
              {medida.curto}
            </Button>
          ))}
        </div>

        <Button
          variant="ghost"
          className="text-muted-foreground h-8 text-[11px]"
          aria-label="Tirar 200 ml"
          disabled={salvando || ml === 0}
          onClick={() => void somar(-200)}
        >
          <Minus aria-hidden className="size-3" />
          200 ml
        </Button>
      </div>
    </Moldura>
  );
}
