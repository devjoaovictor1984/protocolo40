import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, LifeBuoy, Paperclip } from 'lucide-react';

import { EmptyState } from '@/components/stats';
import { Pagination } from '@/components/pagination';
import { listarChamados } from '@/features/admin/repository';
import { TicketStatusBadge } from '@/features/support/components/ticket-status';
import { requireAdmin } from '@/lib/auth/session';
import { cn } from '@/lib/utils';
import { TICKET_KINDS, TICKET_STATUS } from '@/lib/validation/support';
import { formatDay } from '@/services/calendar';
import type { TicketStatus } from '@/types/database';

export const metadata: Metadata = {
  title: 'Chamados',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTROS = [{ value: 'todos', label: 'Todos' }, ...TICKET_STATUS] as const;

const rotuloDoTipo = (kind: string) =>
  TICKET_KINDS.find((item) => item.value === kind)?.label ?? 'Outro';

export default async function ChamadosPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const bruto = typeof params.status === 'string' ? params.status : 'todos';
  const status = (FILTROS.some((item) => item.value === bruto) ? bruto : 'todos') as
    TicketStatus | 'todos';
  const pagina = Number(params.p) > 0 ? Number(params.p) : 1;

  const lista = await listarChamados(status, pagina);

  const endereco = (numero: number, filtro: string = status) => {
    const busca = new URLSearchParams();
    if (filtro !== 'todos') busca.set('status', filtro);
    if (numero > 1) busca.set('p', String(numero));
    const query = busca.toString();
    return query ? `/admin/chamados?${query}` : '/admin/chamados';
  };

  return (
    <div className="flex flex-col gap-6 py-6">
      <header className="flex flex-col gap-4">
        <Link
          href="/admin"
          className="text-muted-foreground hover:text-foreground -ml-1 flex min-h-11 items-center gap-1.5 self-start text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Administração
        </Link>

        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight">Chamados</h1>
          <span className="text-muted-foreground tnum text-sm">{lista.total} no total</span>
        </div>

        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          role="group"
          aria-label="Status"
        >
          {FILTROS.map((filtro) => (
            <Link
              key={filtro.value}
              href={endereco(1, filtro.value)}
              aria-current={status === filtro.value ? 'true' : undefined}
              className={cn(
                'flex min-h-9 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                status === filtro.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted',
              )}
            >
              {filtro.label}
            </Link>
          ))}
        </div>
      </header>

      {lista.itens.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Nenhum chamado aqui."
          description="Quando alguém escrever pela tela de ajuda, aparece nesta lista."
        />
      ) : (
        <>
          <ul className="border-border divide-border divide-y rounded-xl border">
            {lista.itens.map((chamado) => (
              <li key={chamado.id}>
                <Link
                  href={`/admin/chamados/${chamado.id}`}
                  className="hover:bg-muted flex items-start gap-3 p-4 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {chamado.title}
                      {chamado.screenshot_path ? (
                        <Paperclip
                          aria-label="Com print"
                          className="text-muted-foreground size-3.5 shrink-0"
                        />
                      ) : null}
                    </p>
                    <p className="text-muted-foreground tnum mt-0.5 truncate text-xs">
                      {rotuloDoTipo(chamado.kind)} · @{chamado.autor?.username ?? '—'} ·{' '}
                      {formatDay(chamado.created_at.slice(0, 10))}
                    </p>
                  </div>

                  <TicketStatusBadge status={chamado.status} />
                </Link>
              </li>
            ))}
          </ul>

          <Pagination pagina={lista.pagina} paginas={lista.paginas} href={(n) => endereco(n)} />
        </>
      )}
    </div>
  );
}
