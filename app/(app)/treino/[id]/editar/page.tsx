import type { Metadata } from 'next';

import { EditWorkout } from '@/features/workouts/components/edit-workout';

export const metadata: Metadata = {
  title: 'Editar treino',
  robots: { index: false, follow: false },
};

export default async function EditarTreinoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditWorkout clientId={id} />;
}
