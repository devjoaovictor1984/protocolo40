import Link from 'next/link';
import { Check, Play } from 'lucide-react';

import type { SessaoDaTela } from '@/features/tracks/repository';
import { cn } from '@/lib/utils';
import { formatDurationShort } from '@/services/duration';
import { FOCO_LABELS, semanasDaTrilha, type EstadoDaSessao } from '@/services/tracks';

/**
 * O mapa da trilha.
 *
 * As 28 sessões, agrupadas por semana, cada uma com a frase que explica por que
 * ela está ali. É a parte do módulo que faz a diferença entre um programa e uma
 * lista de treinos: sem o porquê, a sessão 4 é "mobilidade" e vira a primeira a
 * ser pulada.
 *
 * Componente de apresentação — recebe `feitas` e desenha. Quem conta é
 * `services/tracks`, e quem corrige com o que ainda não subiu é a ilha de
 * cliente que envolve isto.
 *
 * Toda sessão é clicável, inclusive as que estão adiante. A ordem é sugestão de
 * quem entende de treino, não portaria: quem quiser fazer a 12 hoje, faz.
 */
export function TrackMap({
  sessoes,
  weekTitles,
  feitas,
  matriculado,
}: {
  sessoes: readonly SessaoDaTela[];
  weekTitles: readonly string[];
  /** Sessões já cumpridas. Zero para quem só está olhando de fora. */
  feitas: number;
  matriculado: boolean;
}) {
  const semanas = semanasDaTrilha(sessoes, weekTitles);

  return (
    <div className="flex flex-col gap-6">
      {semanas.map((semana) => {
        const daSemana = semana.sessoes;
        const feitasNaSemana = daSemana.filter((sessao) => sessao.position <= feitas).length;

        return (
          <section key={semana.numero} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-bold tracking-[0.18em] uppercase">
                Semana {semana.numero}
                {semana.titulo ? (
                  <span className="text-muted-foreground font-semibold"> · {semana.titulo}</span>
                ) : null}
              </h2>

              {matriculado ? (
                <span className="text-muted-foreground tnum text-xs">
                  {feitasNaSemana} de {daSemana.length}
                </span>
              ) : null}
            </div>

            <ul className="flex flex-col gap-2">
              {daSemana.map((sessao) => (
                <li key={sessao.position}>
                  <LinhaDaSessao
                    sessao={sessao}
                    estado={
                      !matriculado
                        ? 'adiante'
                        : sessao.position <= feitas
                          ? 'feita'
                          : sessao.position === feitas + 1
                            ? 'atual'
                            : 'adiante'
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function LinhaDaSessao({ sessao, estado }: { sessao: SessaoDaTela; estado: EstadoDaSessao }) {
  const feita = estado === 'feita';
  const atual = estado === 'atual';

  return (
    <Link
      href={`/treinar?template=${sessao.templateId}`}
      aria-label={`Sessão ${sessao.position} — ${sessao.title}${feita ? ', já feita' : ''}`}
      className={cn(
        'flex gap-3 rounded-xl border p-3 transition-colors',
        atual ? 'border-primary bg-primary/8' : 'border-border hover:bg-muted',
        feita && 'opacity-70',
      )}
    >
      {/*
        O número da sessão é o marcador, e o estado nunca é comunicado só por
        cor: quem já fez ganha o ✓ no lugar do número, e a sessão atual leva a
        palavra "agora" ao lado do título.
      */}
      <span
        aria-hidden
        className={cn(
          'tnum flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
          feita && 'bg-success/15 text-success',
          atual && 'bg-primary text-primary-foreground',
          !feita && !atual && 'bg-muted text-muted-foreground',
        )}
      >
        {feita ? <Check className="size-4" /> : sessao.position}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{sessao.title}</span>
          <span className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            {FOCO_LABELS[sessao.focus]} · {formatDurationShort(sessao.estimatedSeconds)}
          </span>
          {atual ? (
            <span className="text-primary text-[11px] font-bold tracking-wider uppercase">
              agora
            </span>
          ) : null}
        </span>

        <span className="text-muted-foreground text-sm leading-relaxed">{sessao.note}</span>
      </span>

      {atual ? <Play aria-hidden className="text-primary mt-1 size-4 shrink-0" /> : null}
    </Link>
  );
}
