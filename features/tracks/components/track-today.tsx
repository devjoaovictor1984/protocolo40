'use client';

import Link from 'next/link';
import { BedDouble, ChevronRight, Map, Play } from 'lucide-react';

import { ProgressRing } from '@/components/progress-ring';
import { ButtonLink } from '@/components/ui/button-link';
import { RestDayButton } from '@/features/rest/components/rest-day-button';
import { useToday } from '@/features/session/session-context';
import { useMeusDias } from '@/features/tracks/use-meus-dias';
import type { TrilhaCompleta } from '@/features/tracks/repository';
import { formatClock } from '@/services/duration';
import { ehDescanso, FOCO_LABELS, progressoNaTrilha } from '@/services/tracks';
import type { TrackRow } from '@/types/database';

/**
 * A trilha na tela de Hoje.
 *
 * A tela de Hoje responde uma pergunta só: o que eu faço agora? Para quem está
 * numa trilha, a resposta deixa de ser "começar treino" e passa a ser "sessão 6:
 * Referência 5·10·15" — que é a mesma coisa, só que com nome, motivo e ordem.
 *
 * Depois do treino do dia ela vira uma faixa fina: o dia já foi resolvido, e o
 * que sobra é saber o que vem amanhã.
 */
export function TrilhaDeHoje({
  dados,
  jaTreinou,
  goalSeconds,
}: {
  dados: TrilhaCompleta;
  jaTreinou: boolean;
  goalSeconds: number;
}) {
  const hoje = useToday();
  const dias = useMeusDias(dados.meusDias);
  const inicio = dados.matricula?.startedOn ?? hoje;
  const progresso = progressoNaTrilha(dados.sessoes, dias, inicio, hoje);

  const proxima = progresso.atual
    ? (dados.sessoes.find((sessao) => sessao.position === progresso.atual!.position) ?? null)
    : null;

  // trilha concluída deixa de ocupar a tela de Hoje: ela virou histórico, e
  // insistir nela seria empurrar um programa que já entregou o que prometeu
  if (!proxima) return null;

  if (jaTreinou) {
    return (
      <Link
        href="/trilha"
        className="border-border hover:bg-muted flex items-center gap-3 rounded-xl border p-4 transition-colors"
      >
        <Map aria-hidden className="text-primary size-5 shrink-0" />
        <span className="flex-1">
          <span className="block text-sm font-semibold">
            {ehDescanso(proxima)
              ? `A seguir na trilha: dia ${proxima.position}, descanso`
              : `A seguir na trilha: dia ${proxima.position}, ${proxima.title}`}
          </span>
          <span className="text-muted-foreground text-sm">
            {progresso.feitas} de {progresso.total} dias · semana {proxima.week}
          </span>
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-4" />
      </Link>
    );
  }

  /*
   * O dia de descanso da trilha.
   *
   * Descansar é o que o programa pede hoje, então o botão principal é o de
   * registrar o descanso — é ele que faz a trilha andar. Treinar continua
   * valendo, e a tela diz isso: a ordem é sugestão, não portaria.
   */
  if (ehDescanso(proxima)) {
    return (
      <section
        aria-label="Seu dia de hoje na trilha"
        className="border-border bg-card flex flex-col items-center gap-5 rounded-2xl border p-6 text-center shadow-sm"
      >
        <p className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">
          Trilha · Dia {proxima.position} de {progresso.total}
        </p>

        <span className="bg-primary/10 text-primary flex size-20 items-center justify-center rounded-full">
          <BedDouble aria-hidden className="size-10" />
        </span>

        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Hoje é descanso</h2>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed text-balance">{proxima.note}</p>
        </div>

        <div className="flex w-full flex-col items-center gap-3">
          <RestDayButton jaDescansou={false} principal />
          <Link
            href="/treinos"
            className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
          >
            Prefiro treinar hoje — também conta
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Sua sessão de hoje"
      className="border-border bg-card flex flex-col items-center gap-5 rounded-2xl border p-6 shadow-sm"
    >
      <p className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">
        Trilha · Semana {proxima.week} · {FOCO_LABELS[proxima.focus]}
      </p>

      <ProgressRing value={progresso.fracao * 100} size={216} strokeWidth={10}>
        <span className="text-muted-foreground text-xs font-bold tracking-[0.18em] uppercase">
          Dia {proxima.position} de {progresso.total}
        </span>
        <span className="tnum mt-1 text-5xl font-extrabold tracking-tight">
          {formatClock(proxima.estimatedSeconds || goalSeconds)}
        </span>
      </ProgressRing>

      <div className="text-center">
        <h2 className="text-lg font-extrabold tracking-tight">{proxima.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed text-balance">
          {proxima.note}
        </p>
      </div>

      <div className="flex w-full flex-col items-center gap-3">
        <ButtonLink
          href={`/treinar?template=${proxima.templateId}`}
          className="h-16 w-full text-base font-bold"
        >
          <Play aria-hidden className="size-5" />
          COMEÇAR O DIA {proxima.position}
        </ButtonLink>

        {/* a trilha é sugestão, não portaria: sair dela hoje custa um toque */}
        <Link
          href="/treinos"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Prefiro outro treino hoje
        </Link>
      </div>
    </section>
  );
}

/**
 * O convite, para quem ainda não está em trilha nenhuma.
 *
 * Aparece na tela de Hoje enquanto a pessoa tem poucos treinos — que é quando
 * "o que eu faço hoje?" ainda não tem resposta automática. Depois disso ele
 * sai: quem já criou rotina não precisa de um programa empurrado toda manhã.
 */
export function ConviteDaTrilha({ trilha }: { trilha: TrackRow }) {
  return (
    <Link
      href="/trilha"
      className="border-primary/40 bg-primary/8 hover:bg-primary/12 flex items-center gap-3 rounded-xl border p-4 transition-colors"
    >
      <Map aria-hidden className="text-primary size-5 shrink-0" />
      <span className="flex-1">
        <span className="block text-sm font-semibold">{trilha.title}</span>
        <span className="text-muted-foreground text-sm">
          {trilha.tagline ?? 'Uma sequência pronta, na ordem certa, para começar sem escolher.'}
        </span>
      </span>
      <ChevronRight aria-hidden className="text-muted-foreground size-4" />
    </Link>
  );
}
