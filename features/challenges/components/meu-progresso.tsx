'use client';

import { Check, Flame } from 'lucide-react';

import { useMeusDias } from '@/features/challenges/use-meus-dias';
import { cn } from '@/lib/utils';
import { WEEKDAY_LABELS, formatDay, parseDay, weekdayIndex } from '@/services/calendar';
import {
  diasDoDesafio,
  progressoNoDesafio,
  recadoDoDesafio,
  type Desafio,
} from '@/services/challenges';

/**
 * O meu progresso no desafio.
 *
 * Ilha de cliente por um motivo só, e é o mesmo da fila offline: o número aqui
 * precisa contar o treino que ainda não subiu. O resto da tela do desafio — a
 * história, o ranking, a arte — continua sendo renderizado no servidor, porque
 * nada disso depende do que está guardado neste aparelho.
 *
 * Os dias chegam do servidor por prop e são corrigidos por `useMeusDias`. Sem
 * isso, quem terminava um treino sem rede via o painel dizer "treino de hoje
 * feito" e o cartão do desafio dizer "hoje ainda está em aberto".
 */

type Janela = Pick<Desafio, 'starts_on' | 'ends_on' | 'goal'>;

/** A versão compacta, do cartão. */
export function ProgressoResumido({
  desafio,
  meusDias,
  hoje,
}: {
  desafio: Janela;
  meusDias: readonly string[];
  hoje: string;
}) {
  const dias = useMeusDias(meusDias);
  const progresso = progressoNoDesafio(desafio, dias, hoje);

  return (
    <div className="flex flex-col gap-2">
      <Barra porcento={Math.round(progresso.fracao * 100)} concluido={progresso.concluido} />

      <div className="flex items-baseline justify-between gap-3">
        <p className="tnum text-sm font-semibold">
          {progresso.cumpridos}
          <span className="text-muted-foreground font-normal"> de {desafio.goal} dias</span>
        </p>
        {progresso.hoje ? (
          <span className="text-success flex items-center gap-1 text-[11px] font-semibold">
            <Flame aria-hidden className="size-3" />
            Hoje está feito
          </span>
        ) : null}
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        {recadoDoDesafio(progresso, desafio.goal)}
      </p>
    </div>
  );
}

/** A versão inteira, da tela do desafio: número grande e a grade do mês. */
export function ProgressoDetalhado({
  desafio,
  meusDias,
  hoje,
}: {
  desafio: Janela;
  meusDias: readonly string[];
  hoje: string;
}) {
  const dias = useMeusDias(meusDias);
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

      <p className="text-sm leading-relaxed">{recadoDoDesafio(progresso, desafio.goal)}</p>

      {progresso.fase !== 'antes' ? (
        <GradeDoDesafio desafio={desafio} dias={dias} hoje={hoje} />
      ) : null}
    </>
  );
}

/**
 * A grade do mês.
 *
 * Um quadradinho por dia da janela. É a mesma leitura do calendário, e serve
 * para uma pergunta que a barra não responde: onde exatamente eu falhei.
 */
function GradeDoDesafio({
  desafio,
  dias,
  hoje,
}: {
  desafio: Janela;
  dias: readonly string[];
  hoje: string;
}) {
  const janela = diasDoDesafio(desafio);
  const feitos = new Set(dias);
  // alinha o primeiro dia na coluna certa da semana
  const vazios = weekdayIndex(janela[0] ?? hoje);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground grid grid-cols-7 gap-1 text-center text-[10px] font-semibold">
        {WEEKDAY_LABELS.map((letra, i) => (
          <span key={i}>{letra}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: vazios }, (_, i) => (
          <span key={`vazio-${i}`} aria-hidden />
        ))}

        {janela.map((dia) => {
          const feito = feitos.has(dia);
          const futuro = dia > hoje;
          const { date } = parseDay(dia);

          return (
            <span
              key={dia}
              title={`${formatDay(dia)}${feito ? ' · treinado' : futuro ? '' : ' · sem treino'}`}
              className={cn(
                'tnum flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold',
                feito && 'bg-primary text-primary-foreground',
                !feito && futuro && 'border-border text-muted-foreground border border-dashed',
                !feito && !futuro && 'bg-muted text-muted-foreground',
                dia === hoje && !feito && 'ring-primary ring-2',
              )}
            >
              {date}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A barra.
 *
 * Sem número dentro dela: o número está do lado, e repetir dentro da barra
 * transforma um sinal em ruído. O estado de concluído muda a cor, mas o texto
 * ao lado é quem comunica — cor sozinha não conta nada a quem não a distingue.
 */
export function Barra({ porcento, concluido }: { porcento: number; concluido: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={porcento}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progresso no desafio"
      className="bg-muted h-2 w-full overflow-hidden rounded-full"
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          concluido ? 'bg-success' : 'bg-primary',
        )}
        style={{ width: `${Math.max(porcento === 0 ? 0 : 3, porcento)}%` }}
      />
    </div>
  );
}
