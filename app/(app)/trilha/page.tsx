import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { conferirConclusaoDaTrilha } from '@/features/tracks/actions';
import { JoinTrack } from '@/features/tracks/components/join-track';
import { TrackMap } from '@/features/tracks/components/track-map';
import { TrackProgress } from '@/features/tracks/components/track-progress';
import { minhaTrilha, trilhaEmDestaque, trilhaPorSlug } from '@/features/tracks/repository';
import { requireSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Trilha',
  robots: { index: false, follow: false },
};

/**
 * A trilha.
 *
 * Server Component: só a barra de progresso e o mapa precisam do aparelho (por
 * causa do treino que ainda não subiu), e eles são a ilha. A promessa, o
 * convite e o botão de entrar são HTML — quem abre esta tela pela primeira vez
 * está decidindo se começa, e essa decisão não depende de JavaScript.
 */
export default async function TrilhaPage() {
  await requireSession();

  // a trilha em que a pessoa está tem prioridade sobre a que o app oferece:
  // quem já entrou não precisa ver o convite de novo
  const minha = await minhaTrilha();
  const destaque = minha ? null : await trilhaEmDestaque();
  const dados = minha ?? (destaque ? await trilhaPorSlug(destaque.slug) : null);

  if (!dados) {
    return (
      <div className="py-6">
        <PageHeader
          titulo="Trilha"
          descricao="Nenhum programa disponível no momento. Os treinos avulsos continuam em Treinos."
        />
      </div>
    );
  }

  const { trilha, matricula } = dados;

  /*
   * A insígnia cai sozinha ao abrir a tela — ninguém deveria precisar clicar
   * para receber o que já conquistou. A função do banco confere os dias e é
   * idempotente: chamar de novo depois de concluída não faz nada.
   */
  if (matricula && !matricula.completedAt) {
    await conferirConclusaoDaTrilha(trilha.slug);
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader titulo={trilha.title} descricao={trilha.tagline ?? undefined} />

      {matricula ? (
        <TrackProgress dados={dados} />
      ) : (
        <>
          {/* a promessa vem antes do mapa: quem ainda não entrou precisa saber
              o que está sendo oferecido antes de olhar 28 linhas */}
          <div className="flex flex-col gap-3 text-sm leading-relaxed">
            {trilha.description.split('\n\n').map((paragrafo, indice) => (
              <p key={indice}>{paragrafo}</p>
            ))}
          </div>

          <JoinTrack slug={trilha.slug} matriculado={false} />

          <TrackMap
            sessoes={dados.sessoes}
            weekTitles={trilha.week_titles}
            feitas={0}
            matriculado={false}
          />
        </>
      )}

      {matricula ? (
        <div className="border-border border-t pt-6">
          <JoinTrack slug={trilha.slug} matriculado />
        </div>
      ) : null}
    </div>
  );
}
