import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { assinarPrint, verChamado } from '@/features/admin/repository';
import { AnswerForm } from '@/features/support/components/answer-form';
import { TicketStatusBadge } from '@/features/support/components/ticket-status';
import { deleteTicket } from '@/features/support/actions';
import { requireAdmin } from '@/lib/auth/session';
import { TICKET_KINDS } from '@/lib/validation/support';
import { formatDay } from '@/services/calendar';

export const metadata: Metadata = {
  title: 'Chamado',
  robots: { index: false, follow: false },
};

const rotuloDoTipo = (kind: string) =>
  TICKET_KINDS.find((item) => item.value === kind)?.label ?? 'Outro assunto';

export default async function ChamadoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const chamado = await verChamado(id);
  if (!chamado) notFound();

  const print = chamado.screenshot_path ? await assinarPrint(chamado.screenshot_path) : null;

  return (
    <div className="flex flex-col gap-6 py-6">
      <Link
        href="/admin/chamados"
        className="text-muted-foreground hover:text-foreground -ml-1 flex min-h-11 items-center gap-1.5 self-start text-sm"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Chamados
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">{chamado.title}</h1>
          <TicketStatusBadge status={chamado.status} />
        </div>

        <p className="text-muted-foreground tnum text-sm">
          {rotuloDoTipo(chamado.kind)} ·{' '}
          <Link
            href={`/admin/usuarios/${chamado.user_id}`}
            className="underline underline-offset-4"
          >
            @{chamado.autor?.username ?? '—'}
          </Link>{' '}
          · {formatDay(chamado.created_at.slice(0, 10))}
        </p>
      </header>

      <section className="border-border rounded-xl border p-4">
        <p className="text-sm whitespace-pre-wrap">{chamado.body}</p>
      </section>

      {print ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Print enviado
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada de curta duração */}
          <img
            src={print}
            alt="Print enviado pelo usuário"
            className="border-border w-full rounded-xl border"
          />
        </section>
      ) : null}

      {chamado.page_url || chamado.user_agent || chamado.app_version ? (
        <section className="border-border text-muted-foreground flex flex-col gap-1 rounded-xl border p-4 text-xs">
          <h2 className="text-[11px] font-semibold tracking-wider uppercase">Contexto</h2>
          {chamado.page_url ? <p className="break-all">Página: {chamado.page_url}</p> : null}
          {chamado.app_version ? <p>Versão: {chamado.app_version}</p> : null}
          {chamado.user_agent ? <p className="break-all">Aparelho: {chamado.user_agent}</p> : null}
        </section>
      ) : null}

      <AnswerForm
        id={chamado.id}
        status={chamado.status}
        answer={chamado.answer}
        respondidoEm={chamado.answered_at}
      />

      <form action={deleteTicket} className="border-destructive/30 rounded-xl border p-4">
        <input type="hidden" name="id" value={chamado.id} />
        <p className="text-muted-foreground mb-3 text-xs">
          Apagar remove o chamado para você e para quem escreveu. Não dá para desfazer.
        </p>
        <Button type="submit" variant="destructive" className="h-11">
          <Trash2 aria-hidden className="size-4" />
          Apagar chamado
        </Button>
      </form>
    </div>
  );
}
