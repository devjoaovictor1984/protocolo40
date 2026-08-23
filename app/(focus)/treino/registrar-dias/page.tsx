import type { Metadata } from 'next';

import { BackfillScreen } from '@/features/workouts/components/backfill-screen';

export const metadata: Metadata = {
  title: 'Registrar dias anteriores',
  robots: { index: false, follow: false },
};

export default function RegistrarDiasPage() {
  return <BackfillScreen />;
}
