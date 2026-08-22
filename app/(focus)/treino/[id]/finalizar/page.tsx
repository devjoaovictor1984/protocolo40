import type { Metadata } from 'next';

import { FinishScreen } from '@/features/workouts/components/finish-screen';

export const metadata: Metadata = {
  title: 'Treino concluído',
  robots: { index: false, follow: false },
};

export default async function FinalizarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FinishScreen clientId={id} />;
}
