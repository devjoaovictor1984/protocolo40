'use client';

import Link from 'next/link';
import { Check, Play, Trophy } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button-link';
import { RestDayButton } from '@/features/rest/components/rest-day-button';
import { useToday } from '@/features/session/session-context';
import { useMeusDias } from '@/features/tracks/use-meus-dias';
import { TrackMap } from '@/features/tracks/components/track-map';
import type { TrilhaCompleta } from '@/features/tracks/repository';
import { cn } from '@/lib/utils';
import { formatDurationShort } from '@/services/duration';
import { ehDescanso, FOCO_LABELS, progressoNaTrilha, recadoDaTrilha } from '@/services/tracks';

/**
 * A trilha em curso.
 *
 * Ilha de cliente pelo mesmo motivo do desafio: o número aqui precisa contar o
 * treino que ainda não subiu. O resto da tela — a promessa, o convite, o botão
 * de entrar — continua no servidor, porque nada disso depende deste aparelho.
 */
export function TrackProgress({ dados }: { dados: TrilhaCompleta }) {
  const hoje = useToday();
  const dias = useMeusDias(dados.meusDias);
  const inicio = dados.matricula?.startedOn ?? hoje;
  const progresso = progressoNaTrilha(dados.sessoes, dias, inicio, hoje);

  const atual = progresso.atual
    ? dados.sessoes.find((sessao) => sessao.position === progresso.atual!.position)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Seu progresso na trilha"
        className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-5"
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="tnum text-3xl font-extrabold tracking-tight">
            {progresso.feitas}
            <span className="text-muted-foreground text-lg font-normal">
              {' '}
              de {progresso.total} dias
            </span>
          </p>

          {progresso.concluida ? (
            <span className="text-success flex items-center gap-1 text-sm font-semibold">
              <Check aria-hidden className="size-4" />
              Concluída
            </span>
          ) : null}
        </div>

        <Barra
          porcento={Math.round(progresso.fracao * 100)}
          concluida={progresso.concluida}
        />

        <p className="text-sm leading-relaxed">{recadoDaTrilha(progresso)}</p>
      </section>

      {progresso.concluida ? (
        <Formatura />
      ) : atual ? (
        <section
          aria-label="Seu próximo dia"
          className="border-primary/40 bg-primary/8 flex flex-col gap-4 rounded-2xl border p-5"
        >
          <p className="text-primary text-[11px] font-bold tracking-[0.18em] uppercase">
            Dia {atual.position} · Semana {atual.week} · {FOCO_LABELS[atual.focus]}
          </p>

          <div>
            <h2 className="text-xl font-extrabold tracking-tight">{atual.title}</h2>
            {atual.templateSubtitle ? (
              <p className="text-muted-foreground mt-0.5 text-sm">{atual.templateSubtitle}</p>
            ) : null}
          </div>

          <p className="text-sm leading-relaxed">{atual.note}</p>

          {/* o descanso se cumpre registrando o descanso, não abrindo o cronômetro */}
          {ehDescanso(atual) || !atual.templateId ? (
            <RestDayButton jaDescansou={false} principal />
          ) : (
            <ButtonLink
              href={`/treinar?template=${atual.templateId}`}
              className="h-14 text-base font-bold"
            >
              <Play aria-hidden className="size-4" />
              COMEÇAR O DIA {atual.position} · {formatDurationShort(atual.estimatedSeconds)}
            </ButtonLink>
          )}
        </section>
      ) : null}

      <TrackMap
        sessoes={dados.sessoes}
        weekTitles={dados.trilha.week_titles}
        feitas={progresso.feitas}
        matriculado
      />
    </div>
  );
}

/** O que a tela mostra quando as 28 sessões acabaram. */
function Formatura() {
  return (
    <section className="border-success/30 bg-success/8 flex flex-col items-center gap-3 rounded-2xl border p-6 text-center">
      <span className="bg-success/15 text-success flex size-14 items-center justify-center rounded-2xl">
        <Trophy aria-hidden className="size-7" />
      </span>

      <div>
        <p className="text-xl font-extrabold tracking-tight">A trilha acabou.</p>
        <p className="text-muted-foreground mt-1 text-sm text-balance">
          A insígnia Via Ápia já está nas suas conquistas. Daqui em diante a biblioteca inteira é
          sua — e o método continua o mesmo: 20 minutos, todos os dias.
        </p>
      </div>

      <Link
        href="/treinos"
        className="text-sm font-medium underline underline-offset-4"
      >
        Escolher o treino de hoje
      </Link>
    </section>
  );
}

/**
 * A barra.
 *
 * Sem número dentro: ele está logo acima, e repetir dentro da barra transforma
 * sinal em ruído. A cor muda no fim, mas quem comunica é o texto — cor sozinha
 * não conta nada a quem não a distingue.
 */
function Barra({ porcento, concluida }: { porcento: number; concluida: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={porcento}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progresso na trilha"
      className="bg-muted h-2 w-full overflow-hidden rounded-full"
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          concluida ? 'bg-success' : 'bg-primary',
        )}
        style={{ width: `${Math.max(porcento === 0 ? 0 : 3, porcento)}%` }}
      />
    </div>
  );
}
