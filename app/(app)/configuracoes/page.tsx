import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, CreditCard, LifeBuoy, Shield } from 'lucide-react';

import {
  DailyGoalField,
  SignOutButton,
  ThemeSwitcher,
} from '@/features/settings/components/settings-controls';
import { requireSession } from '@/lib/auth/session';
import { cobrancaAtiva } from '@/lib/billing/config';

export const metadata: Metadata = {
  title: 'Configurações',
  robots: { index: false, follow: false },
};

export default async function ConfiguracoesPage() {
  const { profile, settings } = await requireSession();

  return (
    <div className="flex flex-col gap-8 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Configurações</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Aparência
        </h2>
        <ThemeSwitcher />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Treino
        </h2>
        <DailyGoalField seconds={settings.daily_goal_seconds} />
        <p className="text-muted-foreground text-sm">
          O cronômetro abre com essa meta. Treinar menos ou mais continua contando igual.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Conta
        </h2>

        <Link
          href="/configuracoes/privacidade"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <span className="flex-1 font-medium">Privacidade</span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

        <Link
          href="/configuracoes/conta"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <span className="flex-1 font-medium">Perfil e dados</span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

        <SignOutButton />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Suporte
        </h2>

        {cobrancaAtiva ? (
          <Link
            href="/planos"
            className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
          >
            <CreditCard aria-hidden className="text-muted-foreground size-5" />
            <span className="flex-1 font-medium">Plano e cobrança</span>
            <ChevronRight aria-hidden className="text-muted-foreground size-4" />
          </Link>
        ) : null}

        <Link
          href="/ajuda"
          className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
        >
          <LifeBuoy aria-hidden className="text-muted-foreground size-5" />
          <span className="flex-1 font-medium">Ajuda e sugestões</span>
          <ChevronRight aria-hidden className="text-muted-foreground size-4" />
        </Link>

        {profile.is_admin ? (
          <Link
            href="/admin"
            className="border-border hover:bg-muted flex min-h-14 items-center gap-3 rounded-xl border px-4 transition-colors"
          >
            <Shield aria-hidden className="text-muted-foreground size-5" />
            <span className="flex-1 font-medium">Administração</span>
            <ChevronRight aria-hidden className="text-muted-foreground size-4" />
          </Link>
        ) : null}
      </section>
    </div>
  );
}
