import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PrivacyForm } from '@/features/settings/components/privacy-form';
import { requireSession } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Privacidade', robots: { index: false, follow: false } };

export default async function PrivacidadePage() {
  const { settings } = await requireSession();

  return (
    <div className="flex flex-col gap-6 py-6">
      <div>
        <Button render={<Link href="/configuracoes" />} variant="ghost" size="sm">
          <ArrowLeft aria-hidden className="size-4" />
          Configurações
        </Button>
      </div>

      <h1 className="text-2xl font-extrabold tracking-tight">Privacidade</h1>

      <PrivacyForm
        settings={{
          profile_visibility: settings.profile_visibility,
          workouts_visibility: settings.workouts_visibility,
          photos_visibility: settings.photos_visibility,
          weight_visibility: settings.weight_visibility,
          measurements_visibility: settings.measurements_visibility,
          streak_visibility: settings.streak_visibility,
          allow_followers: settings.allow_followers,
        }}
      />
    </div>
  );
}
