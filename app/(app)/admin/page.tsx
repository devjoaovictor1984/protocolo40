import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Activity,
  Bell,
  ChevronRight,
  CreditCard,
  Dumbbell,
  Flag,
  LifeBuoy,
  ScrollText,
  Timer,
  UserPlus,
  Users,
} from 'lucide-react';

import { BarChart } from '@/components/charts';
import { StatCard } from '@/components/stats';
import { listarChamados, resumo } from '@/features/admin/repository';
import { TicketStatusBadge } from '@/features/support/components/ticket-status';
import { requireAdmin } from '@/lib/auth/session';
import { formatDay, formatDayShort } from '@/services/calendar';

export const metadata: Metadata = {
  title: 'Administração',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await requireAdmin();

  const [numeros, chamados] = await Promise.all([resumo(), listarChamados('todos', 1)]);
  const ultimos = chamados.itens.slice(0, 5);

  const serieDeCadastros = numeros.cadastrosPorDia.map((ponto) => ({
    label: formatDayShort(ponto.dia),
    value: ponto.total,
    caption: `${formatDay(ponto.dia)} · ${ponto.total} ${ponto.total === 1 ? 'cadastro' : 'cadastros'}`,
  }));

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Administração</h1>
        <p className="text-muted-foreground text-sm">Só você vê esta área.</p>
      </header>

      <section aria-label="Números gerais" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard value={numeros.usuarios} label="Cadastrados" icon={Users} />
        <StatCard value={numeros.usuariosNovos7d} label="Novos em 7 dias" icon={UserPlus} />
        <StatCard value={numeros.usuariosAtivos7d} label="Treinaram em 7 dias" icon={Activity} />
        <StatCard value={numeros.treinos} label="Treinos" icon={Dumbbell} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Cadastros por dia
          </h2>
          <span className="text-muted-foreground tnum text-sm">
            {numeros.usuariosNovos30d} em 30 dias
          </span>
        </div>

        <BarChart
          title="Cadastros"
          unit="pessoas"
          data={serieDeCadastros}
          emptyMessage="Nenhum cadastro nos últimos 30 dias."
        />
      </section>

      <nav className="flex flex-col gap-2">
        <Link
          href="/admin/intervalos"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <Timer aria-hidden className="text-muted-foreground size-5" />
          <span className="flex-1 font-medium">Intervalos</span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

        <Link
          href="/admin/notificacoes"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <Bell aria-hidden className="text-muted-foreground size-5" />
          <span className="flex-1 font-medium">Notificações</span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

        <Link
          href="/admin/desafios"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <Flag aria-hidden className="text-muted-foreground size-5" />
          <span className="flex-1 font-medium">Desafios</span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

        <Link
          href="/admin/usuarios"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <Users aria-hidden className="text-muted-foreground size-5" />
          <span className="flex-1 font-medium">Usuários</span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

        <Link
          href="/admin/planos"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <CreditCard aria-hidden className="text-muted-foreground size-5" />
          <span className="flex-1 font-medium">Planos</span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

        <Link
          href="/admin/auditoria"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <ScrollText aria-hidden className="text-muted-foreground size-5" />
          <span className="flex-1 font-medium">Auditoria</span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

        <Link
          href="/admin/chamados"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <LifeBuoy aria-hidden className="text-muted-foreground size-5" />
          <span className="flex-1 font-medium">Chamados</span>
          {numeros.chamadosAbertos > 0 ? (
            <span className="bg-primary text-primary-foreground tnum rounded-full px-2 py-0.5 text-xs font-bold">
              {numeros.chamadosAbertos}
            </span>
          ) : null}
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>
      </nav>

      {ultimos.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Últimos chamados
          </h2>

          <ul className="border-border divide-border divide-y rounded-xl border">
            {ultimos.map((chamado) => (
              <li key={chamado.id}>
                <Link
                  href={`/admin/chamados/${chamado.id}`}
                  className="hover:bg-muted flex items-center gap-3 p-4 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{chamado.title}</p>
                    <p className="text-muted-foreground tnum mt-0.5 text-xs">
                      @{chamado.autor?.username ?? '—'} ·{' '}
                      {formatDay(chamado.created_at.slice(0, 10))}
                    </p>
                  </div>
                  <TicketStatusBadge status={chamado.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
