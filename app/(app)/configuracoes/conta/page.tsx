import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button-link';
import { ProfileForm } from '@/features/settings/components/profile-form';
import { DeleteAccountSection } from '@/features/settings/components/settings-controls';
import { requireSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Perfil e dados',
  robots: { index: false, follow: false },
};

export default async function ContaPage() {
  const { profile } = await requireSession();

  return (
    <div className="flex flex-col gap-8 py-6">
      <div>
        <ButtonLink href="/configuracoes" variant="ghost" size="sm">
          <ArrowLeft aria-hidden className="size-4" />
          Configurações
        </ButtonLink>
      </div>

      <h1 className="text-2xl font-extrabold tracking-tight">Perfil e dados</h1>

      <ProfileForm profile={profile} />

      <section className="border-border flex flex-col gap-3 border-t pt-8">
        <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
          Zona de risco
        </h2>
        <DeleteAccountSection />
      </section>
    </div>
  );
}
