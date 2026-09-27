'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { Check, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { marcarDia } from '@/features/challenges/actions';
import { Barra } from '@/features/challenges/components/meu-progresso';
import { cn } from '@/lib/utils';
import { addDays, formatDay, formatDayShort } from '@/services/calendar';
import {
  diasMarcaveis,
  emSemanas,
  linhaDoTempo,
  progressoNoDesafio,
  recadoDoDesafio,
  type Desafio,
  type EstadoDoDia,
} from '@/services/challenges';

/**
 * O desafio de marcação: a pessoa diz que venceu o dia.
 *
 * Ilha de cliente pelo botão, e só por ele. A marcação vai direto ao banco (não
 * passa pela fila offline, como o descanso), e o toque aparece na hora pelo
 * `useOptimistic`: esperar a ida e a volta para o botão mudar faz a pessoa
 * tocar duas vezes. Se o banco recusar, o estado volta e a frase explica.
 */

type Janela = Pick<Desafio, 'slug' | 'starts_on' | 'ends_on' | 'goal'>;

type Toque = { dia: string; feito: boolean };

function useMarcacao(slug: string, doServidor: readonly string[]) {
  const [dias, aplicar] = useOptimistic<string[], Toque>([...doServidor], (atual, toque) =>
    toque.feito
      ? [...new Set([...atual, toque.dia])].sort()
      : atual.filter((dia) => dia !== toque.dia),
  );
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const marcar = (dia: string, feito: boolean) => {
    setErro(null);
    iniciar(async () => {
      aplicar({ dia, feito });
      const mensagem = await marcarDia(slug, dia, feito).catch(
        () => 'Não conseguimos marcar agora. Confira a conexão e tente de novo.',
      );
      if (mensagem) setErro(mensagem);
    });
  };

  return { dias, marcar, pendente, erro };
}

/**
 * Os botões do dia.
 *
 * Um só grande, e é o de hoje. O de ontem aparece pequeno, e só enquanto ontem
 * estiver em aberto — é para quem venceu o dia e esqueceu de marcar, não uma
 * segunda chance de decidir.
 */
function BotoesDoDia({
  desafio,
  dias,
  hoje,
  marcar,
  pendente,
}: {
  desafio: Janela;
  dias: readonly string[];
  hoje: string;
  marcar: (dia: string, feito: boolean) => void;
  pendente: boolean;
}) {
  const marcaveis = diasMarcaveis(desafio, hoje);
  const podeHoje = marcaveis.includes(hoje);
  const ontem = addDays(hoje, -1);
  const podeOntem = marcaveis.includes(ontem);

  const hojeVencido = dias.includes(hoje);
  const ontemVencido = dias.includes(ontem);

  if (!podeHoje && !podeOntem) return null;

  return (
    <div className="flex flex-col gap-2">
      {podeHoje ? (
        hojeVencido ? (
          <div className="border-success/30 bg-success/8 flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <span className="text-success flex items-center gap-2 text-sm font-bold">
              <Check aria-hidden className="size-4" />
              Hoje vencido
            </span>
            <button
              type="button"
              onClick={() => marcar(hoje, false)}
              disabled={pendente}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline disabled:opacity-50"
            >
              <Undo2 aria-hidden className="size-3.5" />
              Desfazer
            </button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={() => marcar(hoje, true)}
            disabled={pendente}
            className="h-12 w-full text-base font-extrabold"
          >
            VENCI HOJE
          </Button>
        )
      ) : null}

      {podeOntem && !ontemVencido ? (
        <button
          type="button"
          onClick={() => marcar(ontem, true)}
          disabled={pendente}
          className="text-primary self-start text-xs font-semibold underline-offset-4 hover:underline disabled:opacity-50"
        >
          Venci ontem também ({formatDayShort(ontem)}) — marcar
        </button>
      ) : null}
    </div>
  );
}

function Aviso({ erro }: { erro: string | null }) {
  if (!erro) return null;
  return (
    <p role="alert" className="border-destructive/30 bg-destructive/8 text-destructive rounded-lg border p-3 text-sm">
      {erro}
    </p>
  );
}

/** A versão compacta, do cartão de Hoje. */
export function MarcacaoResumida({
  desafio,
  meusDias,
  hoje,
}: {
  desafio: Janela;
  meusDias: readonly string[];
  hoje: string;
}) {
  const { dias, marcar, pendente, erro } = useMarcacao(desafio.slug, meusDias);
  const progresso = progressoNoDesafio(desafio, dias, hoje);

  return (
    <div className="flex flex-col gap-3">
      <Barra porcento={Math.round(progresso.fracao * 100)} concluido={progresso.concluido} />

      <div className="flex items-baseline justify-between gap-3">
        <p className="tnum text-sm font-semibold">
          {progresso.cumpridos}
          <span className="text-muted-foreground font-normal"> de {desafio.goal} dias vencidos</span>
        </p>
        {progresso.fase === 'durante' ? (
          <span className="text-muted-foreground tnum text-[11px] font-semibold">
            Dia {progresso.decorridos} de {progresso.total}
          </span>
        ) : null}
      </div>

      <BotoesDoDia desafio={desafio} dias={dias} hoje={hoje} marcar={marcar} pendente={pendente} />
      <Aviso erro={erro} />

      <p className="text-muted-foreground text-xs leading-relaxed">
        {recadoDoDesafio(progresso, desafio.goal, 'alimentacao')}
      </p>
    </div>
  );
}

/** A versão inteira, da tela do desafio: número, botões e a linha do tempo. */
export function MarcacaoDetalhada({
  desafio,
  meusDias,
  hoje,
}: {
  desafio: Janela;
  meusDias: readonly string[];
  hoje: string;
}) {
  const { dias, marcar, pendente, erro } = useMarcacao(desafio.slug, meusDias);
  const progresso = progressoNoDesafio(desafio, dias, hoje);

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="tnum text-3xl font-extrabold tracking-tight">
          {progresso.cumpridos}
          <span className="text-muted-foreground text-lg font-normal"> de {desafio.goal} dias</span>
        </p>
        {progresso.concluido ? (
          <span className="text-success flex items-center gap-1 text-sm font-semibold">
            <Check aria-hidden className="size-4" />
            Concluído
          </span>
        ) : null}
      </div>

      <Barra porcento={Math.round(progresso.fracao * 100)} concluido={progresso.concluido} />

      <p className="text-sm leading-relaxed">
        {recadoDoDesafio(progresso, desafio.goal, 'alimentacao')}
      </p>

      <BotoesDoDia desafio={desafio} dias={dias} hoje={hoje} marcar={marcar} pendente={pendente} />
      <Aviso erro={erro} />

      <LinhaDoTempo desafio={desafio} dias={dias} hoje={hoje} />
    </>
  );
}

const DESCRICAO: Record<EstadoDoDia, string> = {
  vencido: 'vencido',
  em_aberto: 'em aberto',
  passou: 'sem marca',
  futuro: 'ainda não chegou',
};

/**
 * A linha do tempo.
 *
 * Uma fileira por semana, um ponto por dia, contados do Dia 1 — e não pelo
 * calendário: em três semanas, "Dia 12 de 21" diz mais do que "14 de novembro".
 *
 * Cada estado tem forma além de cor: vencido leva o ✓, em aberto leva o anel,
 * o futuro é tracejado. Quem não distingue as cores lê a linha do mesmo jeito.
 */
function LinhaDoTempo({
  desafio,
  dias,
  hoje,
}: {
  desafio: Janela;
  dias: readonly string[];
  hoje: string;
}) {
  const semanas = emSemanas(linhaDoTempo(desafio, dias, hoje));

  return (
    <section aria-label="Linha do tempo do desafio" className="flex flex-col gap-4 pt-2">
      {semanas.map((pontos, i) => (
        <div key={i} className="flex flex-col gap-2">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Semana {i + 1}
          </p>

          <ol className="relative flex justify-between">
            {/* o fio que liga os dias da semana, atrás dos pontos */}
            <span aria-hidden className="bg-border absolute inset-x-4 top-1/2 h-px -translate-y-1/2" />

            {pontos.map((ponto) => (
              <li
                key={ponto.dia}
                title={`Dia ${ponto.numero} · ${formatDay(ponto.dia)} · ${DESCRICAO[ponto.estado]}`}
                className={cn(
                  'tnum relative flex size-9 items-center justify-center rounded-full text-[11px] font-bold',
                  ponto.estado === 'vencido' && 'bg-primary text-primary-foreground',
                  ponto.estado === 'em_aberto' && 'bg-background text-foreground ring-primary ring-2',
                  ponto.estado === 'passou' && 'bg-muted text-muted-foreground',
                  ponto.estado === 'futuro' &&
                    'bg-background text-muted-foreground border-border border border-dashed',
                )}
              >
                <span aria-hidden>
                  {ponto.estado === 'vencido' ? <Check className="size-4" /> : ponto.numero}
                </span>
                <span className="sr-only">
                  Dia {ponto.numero}, {formatDay(ponto.dia)}: {DESCRICAO[ponto.estado]}
                  {ponto.hoje ? ' (hoje)' : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}

      <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <span className="flex items-center gap-1">
          <Check aria-hidden className="text-primary size-3" /> vencido
        </span>
        <span>◯ em aberto</span>
        <span>● sem marca — não zera nada</span>
      </p>
    </section>
  );
}
