import type { Metadata } from 'next';

import { ProgressOverview } from '@/features/progress/components/progress-overview';
import { metaAtiva } from '@/features/goals/repository';
import { requireSession } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Evolução', robots: { index: false, follow: false } };

export default async function EvolucaoPage() {
  const { user } = await requireSession();

  // A meta desce do servidor; o peso continua vindo do IndexedDB, que é onde as
  // pesagens existem mesmo sem rede.
  const meta = await metaAtiva(user.id);

  return (
    <ProgressOverview
      meta={
        meta
          ? {
              alvoKg: Number(meta.target_kg),
              inicioKg: Number(meta.start_kg),
              inicioEm: meta.started_on,
              alcancadaEm: meta.achieved_on,
            }
          : null
      }
    />
  );
}
