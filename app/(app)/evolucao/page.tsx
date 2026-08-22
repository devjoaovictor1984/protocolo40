import type { Metadata } from 'next';

import { ProgressOverview } from '@/features/progress/components/progress-overview';

export const metadata: Metadata = { title: 'Evolução', robots: { index: false, follow: false } };

export default function EvolucaoPage() {
  return <ProgressOverview />;
}
