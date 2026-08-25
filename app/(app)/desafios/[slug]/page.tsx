import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ChallengeDetail } from '@/features/challenges/components/challenge-detail';
import { conferirConclusao } from '@/features/challenges/actions';
import { desafioPorSlug } from '@/features/challenges/repository';
import { requireSession } from '@/lib/auth/session';
import { todayIn } from '@/services/calendar';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const desafio = await desafioPorSlug(slug);

  return {
    title: desafio?.title ?? 'Desafio',
    robots: { index: false, follow: false },
  };
}

export default async function DesafioPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { user, profile } = await requireSession();

  const desafio = await desafioPorSlug(slug);
  if (!desafio) notFound();

  /**
   * A insígnia cai sozinha ao abrir a tela.
   *
   * Ninguém deveria precisar clicar para receber o que já conquistou. A função
   * do banco confere os dias e é idempotente; chamar de novo não faz nada.
   */
  if (desafio.participando) {
    await conferirConclusao(slug);
  }

  return (
    <ChallengeDetail
      desafio={desafio}
      hoje={todayIn(profile.timezone)}
      meuId={user.id}
    />
  );
}
