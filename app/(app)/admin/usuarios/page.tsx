import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Search, Shield, Users } from 'lucide-react';

import { EmptyState } from '@/components/stats';
import { Pagination } from '@/components/pagination';
import { Input } from '@/components/ui/input';
import { listarUsuarios } from '@/features/admin/repository';
import { requireAdmin } from '@/lib/auth/session';
import { formatDay } from '@/services/calendar';

export const metadata: Metadata = {
  title: 'Usuários',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function UsuariosPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();

  const params = await searchParams;
  const termo = typeof params.q === 'string' ? params.q : '';
  const pagina = Number(params.p) > 0 ? Number(params.p) : 1;

  const lista = await listarUsuarios(termo, pagina);

  const enderecoDaPagina = (numero: number) => {
    const busca = new URLSearchParams();
    if (termo) busca.set('q', termo);
    if (numero > 1) busca.set('p', String(numero));
    const query = busca.toString();
    return query ? `/admin/usuarios?${query}` : '/admin/usuarios';
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
          <h1 className="text-2xl font-extrabold tracking-tight">Usuários</h1>
          <span className="text-muted-foreground tnum text-sm">{lista.total} no total</span>
        </div>

        {/* GET simples: a busca vira endereço, e voltar funciona */}
        <form action="/admin/usuarios" className="relative">
          <Search aria-hidden className="text-muted-foreground absolute top-3.5 left-3 size-4" />
          <Input
            name="q"
            defaultValue={termo}
            placeholder="Buscar por nome ou @usuário"
            aria-label="Buscar usuário"
            className="h-12 pl-9"
          />
        </form>
      </header>

      {lista.itens.length === 0 ? (
        <EmptyState
          icon={Users}
          title={termo ? 'Ninguém com esse nome.' : 'Nenhum usuário ainda.'}
          description={termo ? 'Tente outro nome ou @usuário.' : 'A lista aparece aqui.'}
        />
      ) : (
        <>
          <ul className="border-border divide-border divide-y rounded-xl border">
            {lista.itens.map((usuario) => (
              <li key={usuario.id}>
                <Link
                  href={`/admin/usuarios/${usuario.id}`}
                  className="hover:bg-muted flex items-center gap-3 p-4 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {usuario.full_name ?? usuario.username}
                      {usuario.is_admin ? (
                        <Shield aria-label="Admin" className="text-primary size-3.5 shrink-0" />
                      ) : null}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      @{usuario.username} · {usuario.email ?? 'sem e-mail'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tnum text-sm font-semibold">{usuario.total_dias} dias</p>
                    <p className="text-muted-foreground tnum text-xs">
                      {usuario.ultimo_treino ? formatDay(usuario.ultimo_treino) : 'nunca treinou'}
                    </p>
                  </div>

                  <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>

          <Pagination pagina={lista.pagina} paginas={lista.paginas} href={enderecoDaPagina} />
        </>
      )}
    </div>
  );
}
