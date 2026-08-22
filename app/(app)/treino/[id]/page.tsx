import type { Metadata } from 'next';

import { WorkoutDetail } from '@/features/workouts/components/workout-detail';

export const metadata: Metadata = {
  title: 'Treino',
  robots: { index: false, follow: false },
};

export default async function TreinoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkoutDetail clientId={id} />;
}
