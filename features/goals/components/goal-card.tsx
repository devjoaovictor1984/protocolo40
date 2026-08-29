'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CircleCheck,
  CircleMinus,
  Info,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';

import { ButtonLink } from '@/components/ui/button-link';
import { cn } from '@/lib/utils';
import { monthLabel } from '@/services/calendar';
import {
  analisarMeta,
  formatarKg,
  type MetaDePeso,
  type PesoRegistrado,
  type SituacaoDaMeta,
} from '@/services/goals';

/**
 * A meta de peso na tela.
 *
 * O número grande é a **tendência**, não a última pesagem — e o card diz isso
 * em texto, porque uma pessoa que se pesou hoje e vê outro número precisa saber
 * de onde ele vem, senão o app parece errado.
 *
 * A situação nunca é comunicada só por cor: cada estado tem ícone, título e
 * frase. Quem não distingue verde de âmbar lê exatamente a mesma informação.
 */

const APARENCIA: Record<
  SituacaoDaMeta,
  {
    icone: typeof Info;
    /** classe do ícone e do texto do título, nunca a única pista do estado */
    tom: string;
  }
> = {
  sem_dados: { icone: Info, tom: 'text-muted-foreground' },
  poucos_dados: { icone: Info, tom: 'text-muted-foreground' },
  alcancada: { icone: CircleCheck, tom: 'text-success' },
  no_ritmo: { icone: CircleCheck, tom: 'text-success' },
  devagar: { icone: Info, tom: 'text-muted-foreground' },
  parada: { icone: CircleMinus, tom: 'text-muted-foreground' },
  rapido_demais: { icone: TriangleAlert, tom: 'text-warning' },
  afastando: { icone: Info, tom: 'text-muted-foreground' },
};

export function GoalCard({
  meta,
  medidas,
  hoje,
}: {
  meta: MetaDePeso | null;
  medidas: readonly PesoRegistrado[];
  hoje: string;
}) {
  if (meta === null) return <SemMeta />;

  const progresso = analisarMeta(meta, medidas, hoje);
  const { icone: Icone, tom } = APARENCIA[progresso.situacao];
  const Direcao = progresso.direcao === 'perder' ? TrendingDown : TrendingUp;

  const percentual = Math.round(progresso.fracao * 100);

  return (
    <section
      aria-labelledby="meta-de-peso"
      className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-4"
    >
      <header className="flex items-center justify-between gap-3">
        <h2 id="meta-de-peso" className="flex items-center gap-2 text-sm font-semibold">
          <Target aria-hidden className="text-muted-foreground size-4" />
          Meta de peso
        </h2>
        <Link
          href="/evolucao/meta"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Ajustar
        </Link>
      </header>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col">
          <span className="tnum text-3xl leading-none font-extrabold tracking-tight">
            {progresso.tendenciaKg === null ? '—' : formatarKg(progresso.tendenciaKg)}
          </span>
          <span className="text-muted-foreground mt-1 text-xs">
            {progresso.tendenciaKg === null
              ? 'sem pesagem recente'
              : `tendência dos últimos ${progresso.janelaDias} dias`}
          </span>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <Direcao aria-hidden className="size-3.5" />
            alvo
          </span>
          <span className="tnum text-lg font-bold">{formatarKg(progresso.alvoKg)}</span>
        </div>
      </div>

      <Barra fracao={progresso.fracao} marcos={progresso.marcos} percentual={percentual} />

      <p className="text-muted-foreground flex justify-between text-xs">
        <span>
          Partida {formatarKg(progresso.inicioKg)} · {formatarKg(progresso.percorridoKg)} percorridos
        </span>
        <span>Faltam {formatarKg(progresso.restanteKg)}</span>
      </p>

      <div className="border-border/60 flex gap-3 border-t pt-4">
        <Icone aria-hidden className={cn('mt-0.5 size-4 shrink-0', tom)} />
        <div className="flex flex-col gap-1">
          <p className={cn('text-sm font-semibold', tom)}>{progresso.leitura.titulo}</p>
          <p className="text-muted-foreground text-sm">{progresso.leitura.texto}</p>
        </div>
      </div>

      {progresso.previsaoEm ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <ArrowRight aria-hidden className="size-4 shrink-0" />
          Nesse ritmo, o alvo chega por volta de{' '}
          <strong className="text-foreground font-semibold">
            {monthLabel(progresso.previsaoEm)}
          </strong>
          .
        </p>
      ) : null}

      {progresso.ultimoKg !== null && progresso.ultimoKg !== progresso.tendenciaKg ? (
        <p className="text-muted-foreground/80 text-xs">
          Última pesagem: {formatarKg(progresso.ultimoKg)}. A balança oscila 1 a 2 kg por água e
          sal — por isso o número acima é a média, e não o do dia.
        </p>
      ) : null}

      {progresso.situacao === 'alcancada' ? (
        <ButtonLink href="/evolucao/meta" className="h-12">
          FECHAR ESTA META
        </ButtonLink>
      ) : null}

      <p className="text-muted-foreground/80 text-xs">
        Estimativas de referência, não avaliação clínica.
      </p>
    </section>
  );
}

/** Barra com os degraus marcados: mostra o caminho, e não só a fração. */
function Barra({
  fracao,
  marcos,
  percentual,
}: {
  fracao: number;
  marcos: { pesoKg: number; atingido: boolean; final: boolean }[];
  percentual: number;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={percentual}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percentual}% do caminho até a meta`}
      className="bg-muted relative h-2 w-full overflow-hidden rounded-full"
    >
      <div
        className="bg-primary h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.round(fracao * 100)}%` }}
      />

      {/* os degraus intermediários; o alvo é a ponta da barra e não vira traço */}
      {marcos
        .filter((marco) => !marco.final)
        .map((marco, indice) => (
          <span
            key={marco.pesoKg}
            aria-hidden
            className={cn(
              'absolute top-0 h-full w-px',
              marco.atingido ? 'bg-primary-foreground/50' : 'bg-border',
            )}
            style={{ left: `${((indice + 1) / (marcos.length || 1)) * 100}%` }}
          />
        ))}
    </div>
  );
}

/** Sem meta definida: convite, nunca cobrança. */
function SemMeta() {
  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Target aria-hidden className="text-muted-foreground size-4" />
        Meta de peso
      </h2>
      <p className="text-muted-foreground text-sm">
        Escolha um peso e o app acompanha a tendência das suas pesagens até lá, com degraus no
        caminho e uma previsão feita a partir do ritmo que se sustenta. Nada de prazo apertado.
      </p>
      <ButtonLink href="/evolucao/meta" variant="outline" className="h-12">
        DEFINIR META
      </ButtonLink>
    </section>
  );
}
