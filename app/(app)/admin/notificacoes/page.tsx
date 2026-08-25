import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Bell, BellOff, Send, Users } from 'lucide-react';

import { StatCard } from '@/components/stats';
import { CampaignForm } from '@/features/notifications/components/campaign-form';
import { requireAdmin } from '@/lib/auth/session';
import { pushConfigurado } from '@/lib/push/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDay } from '@/services/calendar';

export const metadata: Metadata = {
  title: 'Notificações',
  robots: { index: false, follow: false },
};

export default async function AdminNotificacoesPage() {
  await requireAdmin();

  const admin = createAdminClient();

  const [{ count: aparelhos }, { count: pessoas }, { data: campanhas }] = await Promise.all([
    admin.from('push_subscriptions').select('id', { count: 'exact', head: true }),
    admin
      .from('user_settings')
      .select('user_id', { count: 'exact', head: true })
      .eq('push_enabled', true),
    admin
      .from('notification_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
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
          <h1 className="text-2xl font-extrabold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground text-sm">
            Isto aparece no bolso de quem autorizou, sem ser chamado. Vale escrever com cuidado.
          </p>
        </div>
      </header>

      {!pushConfigurado ? (
        <p className="border-destructive/30 bg-destructive/8 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm">
          <BellOff aria-hidden className="mt-0.5 size-4 shrink-0" />
          As chaves VAPID não estão neste ambiente. Preencha NEXT_PUBLIC_VAPID_KEY e
          VAPID_PRIVATE_KEY para conseguir enviar.
        </p>
      ) : null}

      <section aria-label="Alcance" className="grid grid-cols-2 gap-3">
        <StatCard value={pessoas ?? 0} label="Pessoas autorizadas" icon={Users} />
        <StatCard value={aparelhos ?? 0} label="Aparelhos" icon={Bell} />
      </section>

      <section aria-label="Nova campanha" className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Nova campanha
        </h2>
        <CampaignForm inscritos={aparelhos ?? 0} />
      </section>

      {campanhas && campanhas.length > 0 ? (
        <section aria-label="Enviadas" className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Últimas enviadas
          </h2>

          <ul className="flex flex-col gap-2">
            {campanhas.map((campanha) => (
              <li key={campanha.id} className="border-border rounded-xl border p-4">
                <p className="font-semibold">{campanha.title}</p>
                <p className="text-muted-foreground mt-0.5 text-sm">{campanha.body}</p>
                <p className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                  <Send aria-hidden className="size-3" />
                  {campanha.sent_at ? formatDay(campanha.sent_at.slice(0, 10)) : 'não enviada'}
                  <span aria-hidden>·</span>
                  <span className="tnum">{campanha.entregues} entregues</span>
                  {campanha.falhas > 0 ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="tnum">{campanha.falhas} falhas</span>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
