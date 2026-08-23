import type { Metadata } from 'next';
import { LifeBuoy } from 'lucide-react';

import { EmptyState } from '@/components/stats';
import { TicketForm } from '@/features/support/components/ticket-form';
import { TicketStatusBadge } from '@/features/support/components/ticket-status';
import { requireSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { TICKET_KINDS } from '@/lib/validation/support';
import { formatDay } from '@/services/calendar';
import type { SupportTicketRow } from '@/types/database';

export const metadata: Metadata = {
  title: 'Ajuda',
  robots: { index: false, follow: false },
};

const rotuloDoTipo = (kind: string) =>
  TICKET_KINDS.find((item) => item.value === kind)?.label ?? 'Outro assunto';

export default async function AjudaPage() {
  const { user } = await requireSession();
  const supabase = await createClient();

  const { data } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30);

  const tickets = (data ?? []) as SupportTicketRow[];

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Ajuda</h1>
        <p className="text-muted-foreground text-sm">
          Achou um erro, tem uma ideia ou ficou com dúvida? Escreva aqui. Lemos tudo.
        </p>
      </header>

      <TicketForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          O que você já mandou
        </h2>

        {tickets.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title="Nada enviado ainda."
            description="Quando você mandar alguma coisa, o andamento aparece aqui."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {tickets.map((ticket) => (
              <li
                key={ticket.id}
                className="border-border flex flex-col gap-2 rounded-xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{ticket.title}</p>
                    <p className="text-muted-foreground tnum mt-0.5 text-xs">
                      {rotuloDoTipo(ticket.kind)} · {formatDay(ticket.created_at.slice(0, 10))}
                    </p>
                  </div>
                  <TicketStatusBadge status={ticket.status} />
                </div>

                <p className="text-muted-foreground text-sm whitespace-pre-wrap">{ticket.body}</p>

                {ticket.answer ? (
                  <div className="border-primary/40 bg-primary/5 mt-1 rounded-lg border-l-2 p-3">
                    <p className="text-[11px] font-semibold tracking-wider uppercase">Resposta</p>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{ticket.answer}</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
