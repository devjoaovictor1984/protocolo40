import type { Metadata } from 'next';
import { Check, Sparkles } from 'lucide-react';

import { CheckoutButton } from '@/features/billing/components/checkout-button';
import { assinaturaAtual, planosAtivos, precoEmReais } from '@/features/billing/repository';
import { redirect } from 'next/navigation';

import { cobrancaAtiva } from '@/lib/billing/config';
import { requireSession } from '@/lib/auth/session';
import { cn } from '@/lib/utils';
import { formatDay } from '@/services/calendar';

export const metadata: Metadata = {
  title: 'Planos',
  robots: { index: false, follow: false },
};

const INTERVALO: Record<string, string> = {
  mes: '/mês',
  ano: '/ano',
  vitalicio: 'uma vez',
};

/** O que cada chave de recurso significa para quem está lendo. */
const RECURSOS: Record<string, string> = {
  analise: 'Análise do treino, exercício por exercício',
  saude: 'Saúde: água, calorias, proteína e faixa de peso',
  video: 'Vídeo de evolução com as suas fotos',
};

export default async function PlanosPage() {
  // de graça não há plano a escolher; a tela volta quando a cobrança ligar
  if (!cobrancaAtiva) redirect('/hoje');

  const { user } = await requireSession();
  const [planos, assinatura] = await Promise.all([planosAtivos(), assinaturaAtual(user.id)]);

  const ativo =
    assinatura && ['active', 'trialing'].includes(assinatura.status) ? assinatura.plan_slug : 'livre';

  return (
    <div className="flex flex-col gap-8 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Planos</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Treinar, registrar, histórico, calendário, fotos e conquistas são livres para sempre. O
          plano pago libera a Análise e a Saúde.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {planos.map((plano) => {
          const atual = plano.slug === ativo;
          const gratuito = plano.price_cents === 0;

          return (
            <article
              key={plano.slug}
              className={cn(
                'flex flex-col gap-4 rounded-2xl border p-5',
                atual ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-extrabold">
                    {plano.name}
                    {plano.slug === 'anual' ? (
                      <Sparkles aria-hidden className="text-primary size-4" />
                    ) : null}
                  </h2>
                  {plano.tagline ? (
                    <p className="text-muted-foreground text-sm">{plano.tagline}</p>
                  ) : null}
                </div>

                {atual ? (
                  <span className="border-primary text-primary shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
                    Seu plano
                  </span>
                ) : null}
              </div>

              <p className="tnum text-3xl font-extrabold">
                {gratuito ? (
                  'Grátis'
                ) : (
                  <>
                    R$ {precoEmReais(plano.price_cents)}
                    <span className="text-muted-foreground text-base font-normal">
                      {' '}
                      {INTERVALO[plano.interval] ?? ''}
                    </span>
                  </>
                )}
              </p>

              {plano.description ? <p className="text-sm">{plano.description}</p> : null}

              {plano.features.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {plano.features.map((recurso) => (
                    <li key={recurso} className="flex items-start gap-2 text-sm">
                      <Check aria-hidden className="text-success mt-0.5 size-4 shrink-0" />
                      {RECURSOS[recurso] ?? recurso}
                    </li>
                  ))}
                </ul>
              ) : null}

              {atual ? (
                <p className="text-muted-foreground text-xs">
                  {assinatura?.current_period_end
                    ? assinatura.cancel_at_period_end
                      ? `Ativo até ${formatDay(assinatura.current_period_end.slice(0, 10))}, sem renovação.`
                      : `Renova em ${formatDay(assinatura.current_period_end.slice(0, 10))}.`
                    : gratuito
                      ? 'Sem prazo e sem cartão.'
                      : 'Ativo.'}
                </p>
              ) : gratuito ? null : (
                <CheckoutButton slug={plano.slug} disponivel={Boolean(plano.stripe_price_id)} />
              )}
            </article>
          );
        })}
      </div>

      {assinatura && ['active', 'trialing'].includes(assinatura.status) && assinatura.stripe_customer_id ? (
        <a
          href="/api/billing/portal"
          className="border-border hover:bg-muted flex min-h-14 items-center justify-center rounded-xl border text-sm font-medium transition-colors"
        >
          Gerenciar cobrança e nota fiscal
        </a>
      ) : null}

      <p className="text-muted-foreground border-border rounded-xl border p-4 text-xs leading-relaxed">
        A assinatura pode ser cancelada a qualquer momento e continua valendo até o fim do período
        já pago. Cancelar não apaga nada: seus treinos, fotos e conquistas continuam seus, e o app
        volta ao plano Livre.
      </p>
    </div>
  );
}
