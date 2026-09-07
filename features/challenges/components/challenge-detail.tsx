import Link from 'next/link';
import { Check, Flame, Trophy, Users } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { JoinButton } from '@/features/challenges/components/join-button';
import { ProgressoDetalhado } from '@/features/challenges/components/meu-progresso';
import type { DesafioCompleto } from '@/features/challenges/repository';
import { env } from '@/lib/env';
import { avatarUrl, initialsOf } from '@/lib/storage/avatar';
import { cn } from '@/lib/utils';
import { formatDay } from '@/services/calendar';
import { faseDo, posicoes, progressoNoDesafio } from '@/services/challenges';

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
  /*
   * Daqui saem só os números que dependem do calendário — "Dia 3 de 30" é o
   * mesmo para todo mundo. Quantos dias EU cumpri é da ilha de cliente, que
   * conta também o treino que a fila ainda não subiu.
   */
  const fase = faseDo(desafio, hoje);
  const { decorridos, total } = progressoNoDesafio(desafio, [], hoje);
  const ranking = posicoes(desafio.ranking);

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-2">
        <p className="text-primary text-[11px] font-semibold tracking-wider uppercase">
          {fase === 'antes'
            ? 'Começa em breve'
            : fase === 'depois'
              ? 'Encerrado'
              : `Dia ${decorridos} de ${total}`}
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
          <ProgressoDetalhado desafio={desafio} meusDias={desafio.meusDias} hoje={hoje} />
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

      <Ranking linhas={ranking} meuId={meuId} comecou={fase !== 'antes'} />
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
