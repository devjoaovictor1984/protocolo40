import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ScrollText } from 'lucide-react';

import { EmptyState } from '@/components/stats';
import { Pagination } from '@/components/pagination';
import { POR_PAGINA } from '@/features/admin/repository';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDay } from '@/services/calendar';
import type { AdminAuditRow } from '@/types/database';

export const metadata: Metadata = {
  title: 'Auditoria',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Como cada ação se lê para uma pessoa. */
const ACOES: Record<string, string> = {
  plano_concedido: 'Plano concedido',
  plano_revogado: 'Plano removido',
};

export default async function AuditoriaPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const pagina = Number(params.p) > 0 ? Number(params.p) : 1;
  const de = (pagina - 1) * POR_PAGINA;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from('admin_audit_log')
    .select('*, profiles!admin_audit_log_actor_id_fkey(username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(de, de + POR_PAGINA - 1);

  const registros = (data ?? []) as unknown as (AdminAuditRow & {
    profiles: { username: string } | null;
  })[];

  const total = count ?? registros.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

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
          <h1 className="text-2xl font-extrabold tracking-tight">Auditoria</h1>
          <span className="text-muted-foreground tnum text-sm">{total} registros</span>
        </div>

        <p className="text-muted-foreground text-sm">
          Toda concessão e remoção de plano fica aqui, com quem fez e por quê.
        </p>
      </header>

      {registros.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nada registrado ainda."
          description="Conceder ou remover um plano gera uma linha aqui."
        />
      ) : (
        <>
          <ul className="border-border divide-border divide-y rounded-xl border">
            {registros.map((registro) => {
              const detalhe = (registro.detail ?? {}) as Record<string, unknown>;

              return (
                <li key={registro.id} className="flex flex-col gap-1 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{ACOES[registro.action] ?? registro.action}</p>
                    <span className="text-muted-foreground tnum shrink-0 text-xs">
                      {formatDay(registro.created_at.slice(0, 10))}
                    </span>
                  </div>

                  <p className="text-muted-foreground text-xs">
                    por @{registro.profiles?.username ?? '—'}
                    {registro.target_id ? (
                      <>
                        {' · '}
                        <Link
                          href={`/admin/usuarios/${registro.target_id}`}
                          className="underline underline-offset-4"
                        >
                          ver usuário
                        </Link>
                      </>
                    ) : null}
                  </p>

                  {typeof detalhe.motivo === 'string' && detalhe.motivo ? (
                    <p className="text-sm">{detalhe.motivo}</p>
                  ) : null}

                  {typeof detalhe.plano === 'string' ? (
                    <p className="text-muted-foreground text-xs">
                      Plano {detalhe.plano}
                      {typeof detalhe.ate === 'string'
                        ? ` · até ${formatDay(detalhe.ate.slice(0, 10))}`
                        : ' · sem prazo'}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <Pagination
            pagina={pagina}
            paginas={paginas}
            href={(numero) => (numero > 1 ? `/admin/auditoria?p=${numero}` : '/admin/auditoria')}
          />
        </>
      )}
    </div>
  );
}
