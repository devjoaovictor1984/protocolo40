import type { Metadata } from 'next';
import { Trophy } from 'lucide-react';

import { EmptyState } from '@/components/stats';
import { ButtonLink } from '@/components/ui/button-link';
import { ChallengeCard } from '@/features/challenges/components/challenge-card';
import { desafiosAtivos, meusDiasPorDesafio } from '@/features/challenges/repository';
import { requireSession } from '@/lib/auth/session';
import { todayIn } from '@/services/calendar';

export const metadata: Metadata = { title: 'Desafios', robots: { index: false, follow: false } };

export default async function DesafiosPage() {
  const { profile } = await requireSession();
  const hoje = todayIn(profile.timezone);
  const [desafios, diasPorDesafio] = await Promise.all([desafiosAtivos(), meusDiasPorDesafio()]);

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Desafios</h1>
        <p className="text-muted-foreground text-sm">
          Um período, uma meta e uma data de fim. É o que transforma “semana que vem” em hoje.
        </p>
      </header>

      {desafios.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nenhum desafio aberto agora."
          description="Quando abrir um, ele aparece aqui e na tela de Hoje."
          action={
            <ButtonLink href="/treinar" className="h-12">
              COMEÇAR TREINO
            </ButtonLink>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {desafios.map((desafio) => (
            <li key={desafio.id}>
              <ChallengeCard
                desafio={desafio}
                meusDias={diasPorDesafio.get(desafio.id) ?? []}
                hoje={hoje}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
