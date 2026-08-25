import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { alternarDesafio } from '@/features/challenges/admin-actions';
import { ChallengeForm } from '@/features/challenges/components/challenge-form';
import { todosOsDesafios } from '@/features/challenges/repository';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { formatDay } from '@/services/calendar';

export const metadata: Metadata = {
  title: 'Desafios',
  robots: { index: false, follow: false },
};

export default async function AdminDesafiosPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [desafios, { data: insignias }] = await Promise.all([
    todosOsDesafios(),
    supabase.from('badges').select('slug, name').order('sort_order'),
  ]);

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-4">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground -ml-1 flex min-h-11 items-center gap-1.5 self-start text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Administração
        </Link>

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight">Desafios</h1>
          <p className="text-muted-foreground text-sm">
            Um desafio aberto aparece na tela de Hoje de todo mundo. Desligar não apaga nada:
            quem participou mantém a participação e a insígnia.
          </p>
        </div>
      </header>

      {desafios.length > 0 ? (
        <section aria-label="Desafios existentes" className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            No ar
          </h2>

          <ul className="flex flex-col gap-2">
            {desafios.map((desafio) => (
              <li
                key={desafio.id}
                className="border-border flex items-center gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/desafios/${desafio.slug}`}
                      className="truncate font-semibold hover:underline"
                    >
                      {desafio.title}
                    </Link>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        desafio.is_active
                          ? 'bg-success/10 text-success'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {desafio.is_active ? 'no ar' : 'desligado'}
                    </span>
                  </div>

                  <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                    <span>
                      {formatDay(desafio.starts_on)} a {formatDay(desafio.ends_on)}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{desafio.goal} dias</span>
                    <span aria-hidden>·</span>
                    <span className="flex items-center gap-1">
                      <Users aria-hidden className="size-3" />
                      {desafio.participantes}
                    </span>
                  </p>
                </div>

                <form action={alternarDesafio}>
                  <input type="hidden" name="id" value={desafio.id} />
                  <input type="hidden" name="valor" value={desafio.is_active ? '0' : '1'} />
                  <Button type="submit" variant="outline" size="sm" className="h-10">
                    {desafio.is_active ? 'Desligar' : 'Ligar'}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Novo desafio" className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Criar um desafio
        </h2>
        <ChallengeForm desafio={null} insignias={insignias ?? []} />
      </section>
    </div>
  );
}
