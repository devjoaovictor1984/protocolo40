import Link from 'next/link';
import { ChevronRight, Flame, Trophy, Users } from 'lucide-react';

import type { DesafioResumo } from '@/features/challenges/repository';
import { env } from '@/lib/env';
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
  const arte = arteDoDesafio(desafio.image_path);

  return (
    <Link
      href={`/desafios/${desafio.slug}`}
      className="border-border hover:border-primary/50 focus-visible:ring-ring group flex flex-col gap-3 overflow-hidden rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {/*
        A arte é fundo, e o texto vem por cima em elemento de verdade: num
        telefone de 360px, palavra embutida em imagem vira mancha, não acompanha
        o tema e não é lida em voz alta. Sem arte o cartão fica igual, só sem a
        faixa — a imagem melhora, não sustenta.
      */}
      {arte ? (
        <div className="relative aspect-[16/7] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- arte servida do bucket público */}
          <img src={arte} alt="" className="absolute inset-0 size-full object-cover" />

          {/* o véu garante contraste do texto sobre qualquer arte que venha */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
          />

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-4">
            <p className="text-[11px] font-semibold tracking-wider text-white/80 uppercase">
              {progresso.fase === 'antes' ? 'Começa em breve' : 'Desafio em curso'}
            </p>
            <p className="text-lg leading-tight font-extrabold tracking-tight text-white">
              {desafio.title}
            </p>
            {desafio.tagline ? (
              <p className="truncate text-sm text-white/85">{desafio.tagline}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={cn('flex flex-col gap-3 p-4', arte && 'pt-0')}>
      {arte ? null : (
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
      )}

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
          : `${desafio.participantes} ${desafio.participantes === 1 ? 'pessoa' : 'pessoas'} participando`}
      </p>
      </div>
    </Link>
  );
}

/**
 * URL pública da arte.
 *
 * O bucket é público na leitura porque isto é material de divulgação e precisa
 * aparecer para quem ainda não tem conta — ao contrário de foto de progresso,
 * que é privada e só sai por URL assinada de cinco minutos.
 */
export function arteDoDesafio(caminho: string | null): string | null {
  if (!caminho) return null;
  return `${env.supabaseUrl}/storage/v1/object/public/challenge-art/${caminho}`;
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
