import Link from 'next/link';
import { Check, Flame, Trophy, Users } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Barra } from '@/features/challenges/components/challenge-card';
import { JoinButton } from '@/features/challenges/components/join-button';
import type { DesafioCompleto } from '@/features/challenges/repository';
import { env } from '@/lib/env';
import { avatarUrl, initialsOf } from '@/lib/storage/avatar';
import { cn } from '@/lib/utils';
import { WEEKDAY_LABELS, formatDay, parseDay, weekdayIndex } from '@/services/calendar';
import { diasDoDesafio, posicoes, progressoNoDesafio, recadoDoDesafio } from '@/services/challenges';

/**
 * A tela do desafio.
 *
 * Três blocos, nesta ordem: onde você está, o que o desafio é, e quem mais
 * está nele. A ordem não é estética — quem já entrou abre esta tela para ver o
 * próprio número, e quem ainda não entrou precisa da história antes da lista.
 */
export function ChallengeDetail({
  desafio,
  hoje,
  meuId,
}: {
  desafio: DesafioCompleto;
  hoje: string;
  meuId: string;
}) {
  const progresso = progressoNoDesafio(desafio, desafio.meusDias, hoje);
  const ranking = posicoes(desafio.ranking);

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-2">
        <p className="text-primary text-[11px] font-semibold tracking-wider uppercase">
          {progresso.fase === 'antes'
            ? 'Começa em breve'
            : progresso.fase === 'depois'
              ? 'Encerrado'
              : `Dia ${progresso.decorridos} de ${progresso.total}`}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-balance">{desafio.title}</h1>
        {desafio.tagline ? (
          <p className="text-muted-foreground text-lg">{desafio.tagline}</p>
        ) : null}
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <Users aria-hidden className="size-4" />
          {desafio.participantes === 0
            ? 'Ninguém entrou ainda'
            : `${desafio.participantes} ${desafio.participantes === 1 ? 'participando' : 'participando'}`}
          <span aria-hidden>·</span>
          {formatDay(desafio.starts_on)} a {formatDay(desafio.ends_on)}
        </p>
      </header>

      {desafio.participando ? (
        <section aria-label="Seu progresso" className="border-border flex flex-col gap-4 rounded-2xl border p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="tnum text-3xl font-extrabold tracking-tight">
              {progresso.cumpridos}
              <span className="text-muted-foreground text-lg font-normal">
                {' '}
                de {desafio.goal} dias
              </span>
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

          {progresso.fase !== 'antes' ? <GradeDoDesafio desafio={desafio} hoje={hoje} /> : null}
        </section>
      ) : null}

      <section aria-label="Sobre o desafio" className="flex flex-col gap-3">
        {/*
          A divisão aceita CRLF porque textarea de HTML envia CRLF por
          especificação, e arquivo salvo no Windows também. Dividir só em duas
          quebras simples fazia o texto inteiro virar um parágrafo só — sem
          erro, sem aviso, só feio.
        */}
        {desafio.description.split(/\r?\n\s*\r?\n/).map((paragrafo, i) => (
          <p key={i} className="leading-relaxed text-balance">
            {paragrafo}
          </p>
        ))}
      </section>

      <JoinButton slug={desafio.slug} participando={desafio.participando} />

      <Ranking linhas={ranking} meuId={meuId} comecou={progresso.fase !== 'antes'} />
    </div>
  );
}

/**
 * A grade do mês.
 *
 * Um quadradinho por dia da janela. É a mesma leitura do calendário, e serve
 * para uma pergunta que a barra não responde: onde exatamente eu falhei.
 */
function GradeDoDesafio({ desafio, hoje }: { desafio: DesafioCompleto; hoje: string }) {
  const janela = diasDoDesafio(desafio);
  const feitos = new Set(desafio.meusDias);
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
 * O ranking.
 *
 * Constância e nome, nada mais. Empate divide a posição — em desafio de
 * constância, desempatar por horário de cadastro inventaria uma diferença que
 * não existe.
 */
function Ranking({
  linhas,
  meuId,
  comecou,
}: {
  linhas: (DesafioCompleto['ranking'][number] & { posicao: number })[];
  meuId: string;
  comecou: boolean;
}) {
  /*
   * Antes de começar, isto é uma lista de inscritos — não um ranking.
   * Classificar gente com zero dias, numerando do primeiro ao último por ordem
   * de chegada, inventa uma competição que ainda não existe e desanima quem
   * entrou por último sem ter feito nada de errado.
   */
  const titulo = comecou ? 'Ranking' : 'Já entraram';

  if (linhas.length === 0) {
    return (
      <section aria-label={titulo} className="border-border rounded-2xl border border-dashed p-6 text-center">
        <Trophy aria-hidden className="text-muted-foreground mx-auto size-6" />
        <p className="mt-2 text-sm font-semibold">Ninguém entrou ainda. Seja o primeiro.</p>
        <p className="text-muted-foreground mt-1 text-xs">
          A lista mostra só dias mantidos — nunca peso, medida ou foto.
        </p>
      </section>
    );
  }

  return (
    <section aria-label={titulo} className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        {titulo} ({linhas.length})
      </h2>

      <ul className="flex flex-col">
        {linhas.map((linha) => {
          const souEu = linha.user_id === meuId;
          const foto = avatarUrl(linha, env.supabaseUrl);

          return (
            <li
              key={linha.user_id}
              className={cn(
                'border-border flex items-center gap-3 border-b py-2.5 last:border-b-0',
                souEu && 'bg-primary/5 -mx-2 rounded-lg px-2',
              )}
            >
              {comecou ? (
                <span className="tnum text-muted-foreground w-6 shrink-0 text-center text-sm font-bold">
                  {linha.posicao}
                </span>
              ) : null}

              <Avatar className="size-8 shrink-0">
                {foto ? <AvatarImage src={foto} alt="" /> : null}
                <AvatarFallback className="text-[11px] font-semibold">
                  {initialsOf(linha.full_name, linha.username ?? '?')}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                {linha.username ? (
                  <Link href={`/u/${linha.username}`} className="truncate text-sm font-semibold hover:underline">
                    {souEu ? 'Você' : (linha.full_name ?? `@${linha.username}`)}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-semibold">Alguém</span>
                )}
              </div>

              {linha.concluido ? (
                <Check aria-label="Concluiu o desafio" className="text-success size-4 shrink-0" />
              ) : null}

              {comecou ? (
                <span className="tnum flex shrink-0 items-center gap-1 text-sm font-bold">
                  {linha.dias}
                  <Flame aria-hidden className="text-primary size-3.5" />
                  <span className="sr-only">dias</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
