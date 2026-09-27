'use client';

import { useTransition } from 'react';
import { BedDouble, Home, ListChecks, Timer } from 'lucide-react';

import { Emblem } from '@/features/badges/components/emblem';
import { recusarConviteDaTrilha } from '@/features/tracks/actions';
import { JoinTrack } from '@/features/tracks/components/join-track';
import type { BadgeTier, TrackRow } from '@/types/database';

/**
 * O convite da trilha para quem acabou de chegar.
 *
 * O primeiro dia decide se a pessoa volta. Quem nunca treinou abre o app e
 * precisa de uma resposta pronta para "o que eu faço?" — não de quinze treinos
 * para escolher. Este cartão oferece a resposta: trinta dias guiados, leves, em
 * casa, com uma medalha no fim.
 *
 * Oferecer, não impor. "Agora não" vale e fica gravado: o convite grande some e
 * não volta a cada abertura. A trilha segue a um toque, em /trilha.
 */
export function ConviteDoNovato({
  trilha,
  primeiroNome,
  medalha,
}: {
  trilha: TrackRow;
  primeiroNome: string;
  medalha: { name: string; tier: BadgeTier; emblem: string } | null;
}) {
  const [recusando, recusar] = useTransition();

  return (
    <section
      aria-label="Trilha do Iniciante"
      className="border-primary/40 bg-card flex flex-col gap-5 rounded-2xl border-2 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-primary text-[11px] font-bold tracking-[0.18em] uppercase">
            Para começar do jeito certo
          </p>
          <h2 className="mt-1 text-2xl leading-tight font-extrabold tracking-tight text-balance">
            {primeiroNome}, quer que a gente te guie nos primeiros 30 dias?
          </h2>
        </div>
        {medalha ? (
          <Emblem emblem={medalha.emblem} tier={medalha.tier} earned className="size-14 shrink-0" />
        ) : null}
      </div>

      {/* quatro linhas e não um parágrafo: quem decide em dois segundos lê
          a coluna da esquerda e já sabe o que está aceitando */}
      <ul className="flex flex-col gap-3 text-sm">
        <Linha icone={Timer} titulo="Leve de verdade">
          O dia 1 leva uns dez minutos: 10 polichinelos, 5 agachamentos, 3 flexões. Sobe um pouco a
          cada dia.
        </Linha>
        <Linha icone={ListChecks} titulo="Guiado, passo a passo">
          O app diz o exercício, conta o descanso e chama o próximo. Você só segue.
        </Linha>
        <Linha icone={Home} titulo="Em casa, sem equipamento">
          Polichinelo, agachamento, flexão, prancha, corrida parada e abdominais.
        </Linha>
        <Linha icone={BedDouble} titulo="6 treinos e 1 descanso por semana">
          {medalha
            ? `No fim dos 30 dias, a medalha ${medalha.name} é sua.`
            : 'Faltou um dia? O treino te espera no seguinte.'}
        </Linha>
      </ul>

      <div className="flex flex-col gap-1">
        <JoinTrack slug={trilha.slug} matriculado={false} />
        <button
          type="button"
          disabled={recusando}
          onClick={() => recusar(() => recusarConviteDaTrilha())}
          className="text-muted-foreground hover:text-foreground min-h-11 text-sm underline-offset-4 hover:underline disabled:opacity-50"
        >
          Agora não — prefiro escolher meus treinos
        </button>
      </div>
    </section>
  );
}

function Linha({
  icone: Icone,
  titulo,
  children,
}: {
  icone: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icone aria-hidden className="size-4.5" />
      </span>
      <span className="flex flex-col">
        <span className="font-semibold">{titulo}</span>
        <span className="text-muted-foreground leading-snug">{children}</span>
      </span>
    </li>
  );
}
