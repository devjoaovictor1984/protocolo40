'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession, useToday } from '@/features/session/session-context';
import { saveWorkout } from '@/features/workouts/repository';
import { useLocalWorkouts } from '@/features/workouts/use-workout';
import { recarregar } from '@/lib/query/refresh';
import { cn } from '@/lib/utils';
import {
  addDays,
  daysBetween,
  formatDay,
  monthLabel,
  monthKey,
  weekdayIndex,
  WEEKDAY_LABELS,
} from '@/services/calendar';

/**
 * Registrar dias que já passaram.
 *
 * Quem chega ao P20X depois de já ter começado precisa poder trazer o
 * histórico junto — a sequência é o coração do produto, e começar do zero
 * quando você já tem 16 dias é desanimador.
 *
 * O fluxo é de toque: bate no dia, ele fica marcado. Nada de abrir formulário
 * por dia. A duração padrão vale para todos e pode ser ajustada antes.
 */

const SEMANAS = 8;

export function BackfillScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { userId, dailyGoalSeconds } = useSession();
  const today = useToday();
  const { data: workouts, isLoading } = useLocalWorkouts();

  const [minutos, setMinutos] = useState(String(Math.round(dailyGoalSeconds / 60)));
  const [titulo, setTitulo] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  /** Dias que já têm treino: não entram na seleção. */
  const jaRegistrados = useMemo(
    () => new Set((workouts ?? []).map((workout) => workout.workout_date)),
    [workouts],
  );

  /** Oito semanas terminando hoje, alinhadas de segunda a domingo. */
  const dias = useMemo(() => {
    const fim = today;
    const inicio = addDays(fim, -(SEMANAS * 7 - 1));
    const recuo = weekdayIndex(inicio);
    const total = daysBetween(inicio, fim) + 1 + recuo;

    return Array.from({ length: total }, (_, index) => addDays(inicio, index - recuo));
  }, [today]);

  function alternar(dia: string) {
    if (jaRegistrados.has(dia) || dia > today) return;

    setMarcados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(dia)) {
        proximo.delete(dia);
      } else {
        proximo.add(dia);
      }
      return proximo;
    });
  }

  /** Marca a semana inteira de uma vez, para quem treinou todos os dias. */
  function marcarPeriodo(quantidade: number) {
    const proximo = new Set(marcados);
    for (let i = 0; i < quantidade; i += 1) {
      const dia = addDays(today, -i);
      if (!jaRegistrados.has(dia)) proximo.add(dia);
    }
    setMarcados(proximo);
  }

  async function salvar() {
    const duracao = Math.round(Number(minutos) * 60);

    if (!Number.isFinite(duracao) || duracao <= 0) {
      toast.error('Informe quantos minutos duravam os treinos.');
      return;
    }
    if (marcados.size === 0) {
      toast.error('Toque nos dias em que você treinou.');
      return;
    }

    setSalvando(true);

    try {
      // gravados localmente e enfileirados; a rede é detalhe
      for (const dia of [...marcados].sort()) {
        const inicio = new Date(`${dia}T12:00:00`);

        await saveWorkout({
          clientId: crypto.randomUUID(),
          userId,
          templateId: null,
          templateTitle: null,
          title: titulo.trim() || null,
          startedAt: inicio.toISOString(),
          finishedAt: new Date(inicio.getTime() + duracao * 1000).toISOString(),
          durationSeconds: duracao,
          workoutDate: dia,
          rounds: null,
          effort: null,
          location: null,
          notes: null,
          exercises: [],
        });
      }

      await recarregar(queryClient, ['workouts'], ['sync', 'queue']);

      toast.success(
        marcados.size === 1 ? '1 dia registrado.' : `${marcados.size} dias registrados.`,
        { description: 'Sua sequência já conta com eles.' },
      );
      router.replace('/app');
    } catch {
      setSalvando(false);
      toast.error('Não conseguimos salvar todos os dias.', {
        description: 'Os que já entraram foram mantidos. Tente novamente.',
      });
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-5 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  /** Meses presentes na grade, para servir de cabeçalho. */
  const cabecalhos = new Map<string, string>();
  for (const dia of dias) {
    const chave = monthKey(dia);
    if (!cabecalhos.has(chave)) cabecalhos.set(chave, monthLabel(dia));
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-5 py-6">
      <header className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start" onClick={() => router.back()}>
          <ArrowLeft aria-hidden className="size-4" />
          Voltar
        </Button>

        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Registrar dias anteriores</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Já treinava antes de chegar aqui? Toque nos dias e traga sua sequência junto.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="minutos-padrao">Duração de cada um</Label>
          <Input
            id="minutos-padrao"
            type="number"
            inputMode="numeric"
            min="1"
            max="1440"
            value={minutos}
            onChange={(event) => setMinutos(event.target.value)}
            className="tnum h-12 text-base"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="titulo-padrao">Nome (opcional)</Label>
          <Input
            id="titulo-padrao"
            value={titulo}
            onChange={(event) => setTitulo(event.target.value)}
            placeholder="Ex.: Tom Holland"
            maxLength={80}
            className="h-12 text-base"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-muted-foreground w-full text-[11px] font-semibold tracking-wider uppercase">
          Marcar de uma vez
        </span>
        {[7, 14, 30].map((quantidade) => (
          <button
            key={quantidade}
            type="button"
            onClick={() => marcarPeriodo(quantidade)}
            className="border-border hover:bg-muted min-h-10 rounded-full border px-3.5 text-sm font-medium"
          >
            últimos {quantidade} dias
          </button>
        ))}
        {marcados.size > 0 ? (
          <button
            type="button"
            onClick={() => setMarcados(new Set())}
            className="text-muted-foreground hover:text-foreground min-h-10 px-2 text-sm underline underline-offset-4"
          >
            limpar
          </button>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_LABELS.map((label, index) => (
            <span
              key={`${label}-${index}`}
              aria-hidden
              className="text-muted-foreground pb-1 text-center text-[11px] font-semibold"
            >
              {label}
            </span>
          ))}

          {dias.map((dia) => {
            const futuro = dia > today;
            const registrado = jaRegistrados.has(dia);
            const marcado = marcados.has(dia);

            return (
              <button
                key={dia}
                type="button"
                disabled={futuro || registrado}
                onClick={() => alternar(dia)}
                aria-pressed={marcado}
                aria-label={`${formatDay(dia)}${registrado ? ' — já registrado' : marcado ? ' — marcado' : ''}`}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors',
                  futuro && 'opacity-20',
                  registrado && 'bg-secondary text-muted-foreground',
                  marcado && 'bg-primary text-primary-foreground',
                  !futuro && !registrado && !marcado && 'border-border border hover:bg-muted',
                )}
              >
                <span className="tnum">{Number(dia.slice(8))}</span>
                {registrado ? <Check aria-hidden className="mt-0.5 size-3" /> : null}
                {marcado ? (
                  <span aria-hidden className="bg-primary-foreground mt-0.5 size-1 rounded-full" />
                ) : null}
              </button>
            );
          })}
        </div>

        <ul className="text-muted-foreground flex flex-wrap gap-4 text-xs">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="bg-primary size-3 rounded" /> vai registrar
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="bg-secondary size-3 rounded" /> já registrado
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="border-border size-3 rounded border" /> sem treino
          </li>
        </ul>
      </section>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Button
          className="h-14 text-base font-bold"
          disabled={salvando || marcados.size === 0}
          onClick={() => void salvar()}
        >
          {salvando ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              Registrando…
            </>
          ) : marcados.size === 0 ? (
            'Toque nos dias que você treinou'
          ) : (
            `REGISTRAR ${marcados.size} ${marcados.size === 1 ? 'DIA' : 'DIAS'}`
          )}
        </Button>

        <p className="text-muted-foreground text-center text-xs">
          Você pode detalhar exercícios depois, um treino de cada vez.
        </p>
      </div>
    </div>
  );
}
