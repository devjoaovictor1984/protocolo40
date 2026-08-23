import type { Metadata } from 'next';

import { TemplateForm } from '@/features/templates/components/template-form';

export const metadata: Metadata = {
  title: 'Montar meu treino',
  robots: { index: false, follow: false },
};

export default function NovoTreinoPage() {
  return <TemplateForm />;
}
