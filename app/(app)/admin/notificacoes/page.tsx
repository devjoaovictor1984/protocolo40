import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Bell, BellOff, CalendarDays, Send, Trash2, Users } from 'lucide-react';

import { StatCard } from '@/components/stats';
import { apagarCampanha } from '@/features/notifications/admin-actions';
import { CampaignForm } from '@/features/notifications/components/campaign-form';
import { requireAdmin } from '@/lib/auth/session';
import { pushConfigurado } from '@/lib/push/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Button } from '@/components/ui/button';
import { formatDay, todayIn } from '@/services/calendar';
import {
  LIMITE_DIARIO,
  LIMITE_MENSAL,
  orcamentoDeCampanhas,
} from '@/services/campaign-budget';

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
      .limit(20),
  ]);

  const orcamento = orcamentoDeCampanhas(
    (campanhas ?? []).filter((c) => c.status === 'enviada').map((c) => c.sent_at),
    todayIn('America/Sao_Paulo'),
  );

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
        <StatCard
          value={`${orcamento.hoje}/${LIMITE_DIARIO}`}
          label="Hoje"
          icon={Send}
        />
        <StatCard
          value={`${orcamento.mes}/${LIMITE_MENSAL}`}
          label="Neste mês"
          icon={CalendarDays}
        />
      </section>

      {/*
        O limite não vem de navegador nem de serviço de push: as cotas deles
        são altas demais para alguém alcançar mandando campanha à mão. Este é
        um teto nosso, e o que ele protege é o único erro irreversível aqui —
        cansar as pessoas até elas desligarem os avisos. Desligar é definitivo:
        o navegador não pergunta de novo.
      */}
      <p className="text-muted-foreground text-sm leading-relaxed">
        {orcamento.motivo ??
          `Restam ${orcamento.restanteHoje} envio hoje e ${orcamento.restanteMes} no mês. ` +
            'O teto é nosso, não do serviço de push: cada aviso a mais aumenta a chance de alguém desligar todos, e desligar não tem volta.'}
      </p>

      <section aria-label="Nova campanha" className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Nova campanha
        </h2>
        <CampaignForm inscritos={aparelhos ?? 0} orcamento={orcamento} />
      </section>

      {campanhas && campanhas.length > 0 ? (
        <section aria-label="Enviadas" className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Últimas enviadas
          </h2>

          <ul className="flex flex-col gap-2">
            {campanhas.map((campanha) => (
              <li key={campanha.id} className="border-border flex items-start gap-3 rounded-xl border p-4">
                <div className="min-w-0 flex-1">
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
                </div>

                {/* apaga o registro, não a notificação: o que já chegou ao
                    aparelho de alguém não volta atrás */}
                <form action={apagarCampanha}>
                  <input type="hidden" name="id" value={campanha.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive h-10 shrink-0"
                    aria-label={`Apagar do histórico: ${campanha.title}`}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
