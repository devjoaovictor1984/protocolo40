import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarCheck, Clock, Flame, Trophy } from 'lucide-react';

import { StatCard } from '@/components/stats';
import { BadgeGrid } from '@/features/badges/components/badge-grid';
import { conquistasDoUsuario } from '@/features/badges/repository';
import { verUsuario } from '@/features/admin/repository';
import { GrantPlan } from '@/features/billing/components/grant-plan';
import { assinaturaAtual } from '@/features/billing/repository';
import { PerigoDaConta } from '@/features/admin/components/perigo-da-conta';
import { requireAdmin } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { formatDay } from '@/services/calendar';
import { formatDurationShort } from '@/services/duration';

export const metadata: Metadata = {
  title: 'Usuário',
  robots: { index: false, follow: false },
};

export default async function UsuarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAdmin();
  const { id } = await params;

  const usuario = await verUsuario(id);
  if (!usuario) notFound();

  const supabase = await createClient();
  const [{ data: stats }, conquistas, assinatura, { data: planosPagos }] = await Promise.all([
    supabase.rpc('get_user_stats', { p_user: id }),
    conquistasDoUsuario(id),
    assinaturaAtual(id),
    supabase.from('plans').select('slug, name').gt('price_cents', 0).order('sort_order'),
  ]);

  const numeros = stats?.[0] ?? {
    current_streak: 0,
    longest_streak: 0,
    total_days: 0,
    total_seconds: 0,
    last_workout: null,
  };

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-4">
        <Link
          href="/admin/usuarios"
          className="text-muted-foreground hover:text-foreground -ml-1 flex min-h-11 items-center gap-1.5 self-start text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Usuários
        </Link>

        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {usuario.full_name ?? usuario.username}
          </h1>
          <p className="text-muted-foreground text-sm">
            @{usuario.username} · {usuario.email ?? 'sem e-mail'}
          </p>
        </div>
      </header>

      <section aria-label="Números" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          value={numeros.total_days}
          unit="dias"
          label="Dias treinados"
          icon={CalendarCheck}
        />
        <StatCard
          value={Math.round(Number(numeros.total_seconds) / 60)}
          unit="min"
          label="Tempo total"
          icon={Clock}
        />
        <StatCard value={numeros.current_streak} unit="dias" label="Sequência atual" icon={Flame} />
        <StatCard
          value={numeros.longest_streak}
          unit="dias"
          label="Maior sequência"
          icon={Trophy}
        />
      </section>

      <section className="border-border flex flex-col gap-2 rounded-xl border p-4 text-sm">
        <Linha rotulo="Entrou em" valor={formatDay(usuario.created_at.slice(0, 10))} />
        <Linha rotulo="Protocolo iniciado em" valor={formatDay(usuario.protocol_started_on)} />
        <Linha
          rotulo="Último treino"
          valor={usuario.ultimo_treino ? formatDay(usuario.ultimo_treino) : 'nunca treinou'}
        />
        <Linha
          rotulo="Tempo acumulado"
          valor={formatDurationShort(Number(numeros.total_seconds))}
        />
        <Linha rotulo="Nível" valor={usuario.level} />
        <Linha rotulo="Fuso" valor={usuario.timezone} />
        <Linha
          rotulo="Onboarding"
          valor={usuario.onboarding_completed_at ? 'concluído' : 'pendente'}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Conquistas ({conquistas.conquistadas.length})
        </h2>
        <BadgeGrid badges={conquistas.conquistadas} vazio="Nenhuma conquista ainda." />
      </section>

      <GrantPlan
        userId={id}
        planos={(planosPagos ?? []) as { slug: string; name: string }[]}
        atual={
          assinatura
            ? {
                plan_slug: assinatura.plan_slug,
                status: assinatura.status,
                current_period_end: assinatura.current_period_end,
                granted_reason: assinatura.granted_reason,
              }
            : null
        }
      />

      <PerigoDaConta
        id={usuario.id}
        nome={usuario.full_name ?? usuario.username}
        isAdmin={usuario.is_admin}
        ehVoce={usuario.id === user.id}
      />
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="tnum text-right font-medium">{valor}</span>
    </div>
  );
}
