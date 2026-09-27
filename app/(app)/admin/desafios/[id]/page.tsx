import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';

import { ChallengeForm } from '@/features/challenges/components/challenge-form';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Editar desafio',
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

/**
 * Edição de um desafio.
 *
 * A lista levava o nome para a página pública, que só abre desafio ligado — e
 * o desafio que mais precisa de edição é justamente o que ainda não foi ao ar.
 * Clicar para editar o "21 dias sem açúcar" dava "Esta página não existe".
 *
 * Lido pelo id, e não pelo slug, porque o slug é um dos campos editáveis.
 */
export default async function EditarDesafioPage({ params }: { params: Params }) {
  await requireAdmin();
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: desafio }, { data: insignias }] = await Promise.all([
    // a policy deixa o admin ler o desafio desligado
    supabase.from('challenges').select('*').eq('id', id).maybeSingle(),
    supabase.from('badges').select('slug, name').order('sort_order'),
  ]);

  if (!desafio) notFound();

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-4">
        <Link
          href="/admin/desafios"
          className="text-muted-foreground hover:text-foreground -ml-1 flex min-h-11 items-center gap-1.5 self-start text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Desafios
        </Link>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight">{desafio.title}</h1>
          {desafio.is_active ? (
            <Link
              href={`/desafios/${desafio.slug}`}
              className="text-primary flex items-center gap-1.5 self-start text-sm font-semibold hover:underline"
            >
              Ver a página do desafio
              <ExternalLink aria-hidden className="size-3.5" />
            </Link>
          ) : (
            <p className="text-muted-foreground text-sm">
              Desligado: ninguém vê este desafio, e a página dele só abre depois de ligar.
            </p>
          )}
        </div>
      </header>

      <ChallengeForm desafio={desafio} insignias={insignias ?? []} />
    </div>
  );
}
