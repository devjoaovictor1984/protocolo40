import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { BadgeGrid } from '@/features/badges/components/badge-grid';
import { Emblem } from '@/features/badges/components/emblem';
import { conquistasDoUsuario, progressoAtual } from '@/features/badges/repository';
import { requireSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Conquistas',
  robots: { index: false, follow: false },
};

export default async function ConquistasPage() {
  const { user } = await requireSession();

  const [conquistas, progresso] = await Promise.all([
    conquistasDoUsuario(user.id),
    progressoAtual(user.id),
  ]);

  const proxima = conquistas.proxima;
  const dias = progresso.dias ?? 0;
  const faltam =
    proxima && proxima.metric === 'dias' ? Math.max(0, proxima.threshold - dias) : null;
  const percentual =
    proxima && proxima.metric === 'dias' && proxima.threshold > 0
      ? Math.min(100, Math.round((dias / proxima.threshold) * 100))
      : null;

  const bloqueadas = conquistas.todas.filter((badge) => !badge.earned);

  return (
    <div className="flex flex-col gap-8 py-6">
      <PageHeader
        titulo="Conquistas"
        descricao={`${conquistas.conquistadas.length} de ${conquistas.todas.length} insígnias. Cada uma é dada pelo que você já fez — nenhuma se compra.`}
        trilha={[{ href: '/perfil', label: 'Perfil' }]}
      />

      {proxima ? (
        <section className="border-border bg-card flex items-center gap-4 rounded-2xl border p-4">
          <Emblem emblem={proxima.emblem} tier={proxima.tier} earned={false} className="size-16" />

          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
              Próxima
            </p>
            <p className="text-lg font-extrabold">{proxima.name}</p>

            {faltam !== null ? (
              <>
                <p className="text-muted-foreground tnum mt-0.5 text-sm">
                  {faltam === 0
                    ? 'Cai no seu próximo treino.'
                    : `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'} de treino.`}
                </p>

                {percentual !== null ? (
                  <div
                    role="progressbar"
                    aria-valuenow={dias}
                    aria-valuemin={0}
                    aria-valuemax={proxima.threshold}
                    aria-label={`Progresso para ${proxima.name}`}
                    className="bg-secondary mt-2 h-2 w-full overflow-hidden rounded-full"
                  >
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground mt-0.5 text-sm">{proxima.description}</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Conquistadas
        </h2>
        <BadgeGrid
          badges={conquistas.conquistadas}
          vazio="Seu primeiro treino já vale a primeira insígnia."
        />
      </section>

      {bloqueadas.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Ainda pela frente
          </h2>
          <BadgeGrid badges={bloqueadas} />
        </section>
      ) : null}
    </div>
  );
}
