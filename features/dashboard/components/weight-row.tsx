'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Scale } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { localMeasurements, saveMeasurement } from '@/features/measurements/repository';
import { useSession, useToday } from '@/features/session/session-context';
import { relativeDay } from '@/services/calendar';

/**
 * Peso do dia, direto na tela de hoje.
 *
 * Registrar peso é a segunda coisa mais frequente depois de treinar, e obrigar
 * a abrir outra tela para digitar um número fazia dela uma tarefa. Aqui é uma
 * linha: o campo já está aberto, e some assim que o dia é registrado.
 */
export function WeightRow() {
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

  if (isLoading) return null;

  const deHoje = (medidas ?? []).find((item) => item.measured_on === today);
  const ultimo = (medidas ?? []).find((item) => item.weight_kg !== null);

  /*
   * O campo já vem com o último peso.
   *
   * Antes ele aparecia só como dica, e o resultado era um número visível com
   * o botão apagado ao lado: parecia preenchido e não funcionava. O peso muda
   * pouco de um dia para o outro, então partir do anterior é o caminho curto —
   * e ajustar é um toque.
   */
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
      await queryClient.invalidateQueries({ queryKey: ['measurements'] });
      await queryClient.invalidateQueries({ queryKey: ['sync', 'queue'] });
      setValor(null);
      toast.success('Peso registrado.');
    } catch {
      toast.error('Não conseguimos salvar agora.', { description: 'Tente novamente.' });
    } finally {
      setSalvando(false);
    }
  }

  // já registrou hoje: a linha vira um resumo discreto
  if (deHoje?.weight_kg) {
    return (
      <Link
        href="/medidas"
        className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
      >
        <Check aria-hidden className="text-success size-4 shrink-0" />
        <span className="flex-1 text-sm">
          Peso de hoje:{' '}
          <span className="tnum font-semibold">
            {deHoje.weight_kg.toFixed(1).replace('.', ',')} kg
          </span>
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-4" />
      </Link>
    );
  }

  return (
    <section
      aria-label="Peso de hoje"
      className="border-border flex flex-col gap-2 rounded-xl border p-4"
    >
      <div className="flex items-center gap-2">
        <Scale aria-hidden className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">Peso de hoje</span>
        {ultimo?.weight_kg ? (
          <span className="text-muted-foreground tnum ml-auto text-xs">
            {relativeDay(ultimo.measured_on, today)}
          </span>
        ) : null}
      </div>

      <div className="flex gap-2">
        {/*
          type="text" e não "number": um campo numérico do HTML recusa vírgula,
          e no Brasil o peso se escreve 86,4. O teclado decimal continua sendo
          o que aparece no celular.
        */}
        <Input
          type="text"
          inputMode="decimal"
          value={preenchido}
          onChange={(event) => setValor(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void registrar();
          }}
          placeholder="86,4"
          aria-label="Peso de hoje em quilos"
          className="tnum h-12 flex-1 text-base"
        />
        <Button
          className="h-12 px-5"
          disabled={salvando || !preenchido.trim()}
          onClick={() => void registrar()}
        >
          {salvando ? 'Salvando…' : 'Registrar'}
        </Button>
      </div>

      <Link
        href="/medidas?novo=1"
        className="text-muted-foreground hover:text-foreground self-start text-xs underline underline-offset-4"
      >
        Registrar um dia anterior ou outras medidas
      </Link>
    </section>
  );
}
