import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { IntervalDemo } from '@/features/timer/components/interval-demo';
import { requireAdmin } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Intervalos',
  robots: { index: false, follow: false },
};

export default async function AdminIntervalosPage() {
  await requireAdmin();

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
          <h1 className="text-2xl font-extrabold tracking-tight">Intervalos</h1>
          <p className="text-muted-foreground text-sm">
            Para gravar a demonstração. Roda acelerado, mostra quando cada som vai tocar e permite
            tocar os três separados.
          </p>
        </div>
      </header>

      <IntervalDemo />

      <section className="border-border flex flex-col gap-2 rounded-xl border p-4 text-sm">
        <h2 className="font-semibold">O que vale explicar no vídeo</h2>
        <ul className="text-muted-foreground flex list-disc flex-col gap-1.5 pl-4 leading-relaxed">
          <li>
            Dois toques agudos = comece. Um toque grave e longo = pare. Três toques curtos = está
            acabando. Dá para treinar de olhos fechados.
          </li>
          <li>
            O som é gerado pelo próprio aparelho, não é arquivo baixado — funciona sem internet.
          </li>
          <li>
            A tela fica acesa sozinha durante o treino com intervalo, senão o telefone dorme e o som
            para.
          </li>
          <li>
            No iPhone, a chavinha de silencioso corta o som da web. No Android, o aparelho também
            vibra junto.
          </li>
        </ul>
      </section>
    </div>
  );
}
