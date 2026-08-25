import Link from 'next/link';
import { ChevronRight, Flame, Trophy, Users } from 'lucide-react';

import type { DesafioResumo } from '@/features/challenges/repository';
import { cn } from '@/lib/utils';
import { formatDayShort } from '@/services/calendar';
import { progressoNoDesafio, recadoDoDesafio } from '@/services/challenges';

/**
 * O desafio na tela de Hoje.
 *
 * Um cartão, nunca uma lista: a tela inicial já tem treino, água, peso e
 * mensagem do dia. O desafio entra como convite, e some assim que não houver
 * nenhum aberto.
 *
 * Quem não entrou vê o convite; quem entrou vê onde está. São duas telas
 * diferentes dentro do mesmo espaço, e a diferença é proposital: antes de
 * entrar o que importa é a ideia, depois de entrar o que importa é o número.
 */
export function ChallengeCard({
  desafio,
  meusDias,
  hoje,
}: {
  desafio: DesafioResumo;
  meusDias: readonly string[];
  hoje: string;
}) {
  const progresso = progressoNoDesafio(desafio, meusDias, hoje);
  const porcento = Math.round(progresso.fracao * 100);

  return (
    <Link
      href={`/desafios/${desafio.slug}`}
      className="border-border hover:border-primary/50 focus-visible:ring-ring group flex flex-col gap-3 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl"
        >
          <Trophy className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wider uppercase opacity-70">
            {progresso.fase === 'antes' ? 'Começa em breve' : 'Desafio em curso'}
          </p>
          <p className="truncate text-base font-extrabold tracking-tight">{desafio.title}</p>
          {desafio.tagline ? (
            <p className="text-muted-foreground truncate text-sm">{desafio.tagline}</p>
          ) : null}
        </div>

        <ChevronRight
          aria-hidden
          className="text-muted-foreground group-hover:text-foreground mt-2 size-4 shrink-0 transition-colors"
        />
      </div>

      {desafio.participando ? (
        <div className="flex flex-col gap-2">
          <Barra porcento={porcento} concluido={progresso.concluido} />

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
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs leading-relaxed">
            {formatDayShort(desafio.starts_on)} a {formatDayShort(desafio.ends_on)} ·{' '}
            {desafio.goal} dias para concluir
          </p>
          <p className="text-primary text-sm font-semibold">Entrar no desafio →</p>
        </div>
      )}

      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Users aria-hidden className="size-3" />
        {desafio.participantes === 0
          ? 'Ninguém entrou ainda. Seja o primeiro.'
          : `${desafio.participantes} ${desafio.participantes === 1 ? 'pessoa' : 'pessoas'} ${desafio.participantes === 1 ? 'participando' : 'participando'}`}
      </p>
    </Link>
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
