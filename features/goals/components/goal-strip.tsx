'use client';

import Link from 'next/link';
import { ChevronRight, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { localMeasurements } from '@/features/measurements/repository';
import { useSession, useToday } from '@/features/session/session-context';
import { analisarMeta, formatarKg, type MetaDePeso } from '@/services/goals';

/**
 * A meta de peso na tela de hoje.
 *
 * Versão curta do card de `/evolucao`: uma linha, uma barra fina, sem
 * diagnóstico e sem previsão. A tela de hoje responde "o que eu faço agora", e
 * peso não é tarefa do dia — quem quiser o texto inteiro toca e vai para a
 * tela da meta.
 *
 * Isso não é economia de espaço, é cuidado: `/hoje` é a tela que a pessoa abre
 * todo dia, e transformar o corpo dela em cobrança diária é o oposto do que
 * este app se propõe. Aqui cabe o número e o caminho andado, nada mais.
 *
 * O peso vem do IndexedDB, como em toda a Evolução: a tela abre sem rede.
 */
export function GoalStrip({ meta }: { meta: MetaDePeso | null }) {
  const { userId } = useSession();
  const hoje = useToday();

  const { data: medidas } = useQuery({
    queryKey: ['measurements', userId],
    queryFn: () => localMeasurements(userId),
    staleTime: 10_000,
  });

  if (meta === null) return <Convite />;

  const progresso = analisarMeta(meta, medidas ?? [], hoje);
  const percentual = Math.round(progresso.fracao * 100);

  return (
    <Link
      href="/evolucao/meta"
      aria-label={`Meta de peso: ${percentual}% do caminho até ${formatarKg(progresso.alvoKg)}`}
      className="border-border hover:bg-muted flex flex-col gap-3 rounded-xl border p-4 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Target aria-hidden className="text-muted-foreground size-4 shrink-0" />

        <span className="flex flex-1 items-baseline gap-2">
          <span className="tnum font-semibold">
            {progresso.tendenciaKg === null ? '—' : formatarKg(progresso.tendenciaKg)}
          </span>
          <span className="text-muted-foreground text-sm">
            de {formatarKg(progresso.alvoKg)}
          </span>
        </span>

        <span className="text-muted-foreground text-sm">
          {progresso.tendenciaKg === null
            ? 'sem pesagem'
            : progresso.situacao === 'alcancada'
              ? 'alvo alcançado'
              : `faltam ${formatarKg(progresso.restanteKg)}`}
        </span>

        <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
      </div>

      <div
        role="progressbar"
        aria-valuenow={percentual}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-[width] duration-500"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </Link>
  );
}

/**
 * Quem ainda não tem meta.
 *
 * Borda tracejada e uma linha só, como o convite de registrar dias anteriores:
 * é oferta, não pendência. A tela de hoje não pode ganhar uma tarefa nova toda
 * vez que o app ganha uma funcionalidade.
 */
function Convite() {
  return (
    <Link
      href="/evolucao/meta"
      className="border-border hover:bg-muted flex items-center gap-3 rounded-xl border border-dashed p-4 transition-colors"
    >
      <Target aria-hidden className="text-primary size-5 shrink-0" />
      <span className="flex-1">
        <span className="block text-sm font-semibold">Quer um peso para mirar?</span>
        <span className="text-muted-foreground text-sm">
          Defina uma meta e acompanhe a tendência até lá, no seu ritmo
        </span>
      </span>
      <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
    </Link>
  );
}
