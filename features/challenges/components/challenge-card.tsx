import Link from 'next/link';
import { Check, ChevronRight, Salad, Trophy, Users } from 'lucide-react';

import { MarcacaoResumida } from '@/features/challenges/components/marcacao';
import { ProgressoResumido } from '@/features/challenges/components/meu-progresso';
import type { DesafioResumo } from '@/features/challenges/repository';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';
import { formatDayShort } from '@/services/calendar';
import { faseDo, janelaDoDesafio } from '@/services/challenges';

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
  // só a fase sai daqui: ela depende das datas, e não do que este aparelho
  // sabe. O número de dias é da ilha de cliente, que conta o que não subiu.
  //
  // No desafio de data pessoal a janela é a desta pessoa; sem início escolhido
  // não há janela, e o cartão é um convite aberto.
  const pessoal = Boolean(desafio.duration_days);
  const janela = janelaDoDesafio(desafio, desafio.meuInicio);
  const meuDesafio = janela ? { ...desafio, ...janela } : desafio;
  const fase = janela ? faseDo(janela, hoje) : 'antes';
  const arte = arteDoDesafio(desafio.image_path);
  const href = `/desafios/${desafio.slug}`;
  const alimentacao = desafio.kind === 'alimentacao';

  const quando =
    pessoal && !janela
      ? 'Comece quando quiser'
      : fase === 'antes'
        ? `Começa ${formatDayShort(meuDesafio.starts_on)}`
        : 'Em curso';
  const chamada = `${quando} · ${alimentacao ? 'Alimentação' : 'Treino'}`;

  /*
   * O cartão inteiro leva à tela do desafio, mas não é mais um <Link> por
   * fora: o desafio de alimentação tem o botão "Venci hoje" dentro dele, e
   * botão dentro de link é HTML inválido — o toque no botão também navegava.
   * O link é o título, esticado sobre o cartão por `after:inset-0`; o que
   * precisa de clique próprio fica por cima com `z-10`.
   */
  return (
    <article
      aria-label={desafio.title}
      className="border-border hover:border-primary/50 has-[a:focus-visible]:ring-ring group relative flex flex-col gap-3 overflow-hidden rounded-2xl border transition-colors has-[a:focus-visible]:ring-2"
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
            <p className="text-[11px] font-semibold tracking-wider text-white/80 uppercase">{chamada}</p>
            <Link
              href={href}
              className="text-lg leading-tight font-extrabold tracking-tight text-white outline-none after:absolute after:inset-0 after:content-['']"
            >
              {desafio.title}
            </Link>
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
          {alimentacao ? <Salad className="size-5" /> : <Trophy className="size-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wider uppercase opacity-70">{chamada}</p>
          <Link
            href={href}
            className="block truncate text-base font-extrabold tracking-tight outline-none after:absolute after:inset-0 after:content-['']"
          >
            {desafio.title}
          </Link>
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

      {desafio.participando && fase === 'antes' ? (
        // já entrou num que não começou: a barra zerada e "entre agora" diriam
        // o contrário do que aconteceu
        <p className="text-success flex items-center gap-1.5 text-sm font-semibold">
          <Check aria-hidden className="size-4" />
          Você já está dentro. Começa {formatDayShort(meuDesafio.starts_on)}.
        </p>
      ) : desafio.participando && alimentacao ? (
        <div className="relative z-10">
          <MarcacaoResumida desafio={meuDesafio} meusDias={meusDias} hoje={hoje} />
        </div>
      ) : desafio.participando ? (
        <ProgressoResumido desafio={meuDesafio} meusDias={meusDias} hoje={hoje} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs leading-relaxed">
            {pessoal
              ? `${desafio.duration_days} dias a partir do dia que você escolher · medalha com ${desafio.goal}`
              : `${formatDayShort(desafio.starts_on)} a ${formatDayShort(desafio.ends_on)} · ${desafio.goal} dias para concluir`}
          </p>
          {/*
            "Ver", e não "Entrar": este cartão é um link para a tela do desafio,
            e é lá que existe o botão de inscrição. Prometer a ação aqui fez
            gente clicar, ser levada para a tela e sair achando que tinha
            entrado — sem estar.
          */}
          <p className="text-primary text-sm font-semibold">
            {pessoal
              ? 'Escolher quando começar →'
              : fase === 'antes'
                ? 'Ver o desafio e garantir a vaga →'
                : 'Ver o desafio →'}
          </p>
        </div>
      )}

      <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
        <Users aria-hidden className="size-3" />
        {desafio.participantes === 0
          ? 'Ninguém entrou ainda. Seja o primeiro.'
          : `${desafio.participantes} ${desafio.participantes === 1 ? 'pessoa' : 'pessoas'} participando`}
      </p>
      </div>
    </article>
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
