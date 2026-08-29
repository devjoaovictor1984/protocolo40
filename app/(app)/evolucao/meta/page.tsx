import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { GoalForm } from '@/features/goals/components/goal-form';
import { metaAtiva, metasConcluidas, pesoMaisRecente } from '@/features/goals/repository';
import { requireSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { addDays, formatDay, todayIn } from '@/services/calendar';
import { formatarKg, tendenciaEm } from '@/services/goals';

export const metadata: Metadata = {
  title: 'Meta de peso',
  robots: { index: false, follow: false },
};

export default async function MetaPage() {
  const { user, profile } = await requireSession();
  const hoje = todayIn(profile.timezone);

  const supabase = await createClient();

  const [meta, peso, concluidas, { data: pesagens }] = await Promise.all([
    metaAtiva(user.id),
    pesoMaisRecente(user.id),
    metasConcluidas(user.id),
    supabase
      .from('body_measurements')
      .select('measured_on, weight_kg')
      .eq('user_id', user.id)
      .not('weight_kg', 'is', null)
      .is('deleted_at', null)
      // três semanas é a janela mais larga que a tendência chega a abrir
      .gte('measured_on', addDays(hoje, -21))
      .order('measured_on', { ascending: false }),
  ]);

  const tendencia = tendenciaEm(pesagens ?? [], hoje);

  const alcancavel =
    meta !== null &&
    tendencia !== null &&
    (Number(meta.target_kg) < Number(meta.start_kg)
      ? tendencia.kg <= Number(meta.target_kg)
      : tendencia.kg >= Number(meta.target_kg));

  return (
    <div className="flex flex-col gap-6 py-6">
      <PageHeader
        titulo="Meta de peso"
        descricao="Você escolhe o alvo; o prazo o app calcula a partir do que se sustenta."
        trilha={[{ href: '/evolucao', label: 'Evolução' }]}
      />

      <GoalForm
        alvoAtual={meta ? Number(meta.target_kg) : null}
        pesoAtualKg={peso?.kg ?? null}
        pesoEm={peso?.em ?? null}
        alturaCm={profile.height_cm}
        temMeta={meta !== null}
        metaAlcancavel={alcancavel}
        hoje={hoje}
      />

      {concluidas.length > 0 ? (
        <section aria-labelledby="metas-concluidas" className="flex flex-col gap-3">
          <h2
            id="metas-concluidas"
            className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase"
          >
            Já alcançadas
          </h2>
          <ul className="flex flex-col gap-2">
            {concluidas.map((antiga) => (
              <li
                key={antiga.id}
                className="border-border flex items-baseline justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
              >
                <span>
                  {formatarKg(Number(antiga.start_kg))} → {formatarKg(Number(antiga.target_kg))}
                </span>
                <span className="text-muted-foreground text-xs">
                  {antiga.achieved_on ? formatDay(antiga.achieved_on) : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-muted-foreground text-sm">
        A meta é sua e de mais ninguém: ela não aparece no seu perfil, não entra na comunidade e
        nunca vira notificação. Nada aqui substitui avaliação de profissional de saúde.
      </p>
    </div>
  );
}
