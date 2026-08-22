import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { OnboardingFlow } from '@/features/onboarding/components/onboarding-flow';
import { needsOnboarding, requireSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Primeiro acesso',
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const { profile } = await requireSession();

  // quem já passou por aqui não precisa ver de novo
  if (!needsOnboarding(profile)) {
    redirect('/app');
  }

  return <OnboardingFlow defaultUsername={profile.username} defaultName={profile.full_name} />;
}
