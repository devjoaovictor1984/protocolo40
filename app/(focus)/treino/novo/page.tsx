import type { Metadata } from 'next';

import { WorkoutForm } from '@/features/workouts/components/workout-form';

export const metadata: Metadata = {
  title: 'Registrar treino',
  robots: { index: false, follow: false },
};

export default function NovoTreinoPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-5">
      <WorkoutForm />
    </div>
  );
}
