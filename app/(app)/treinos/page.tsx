import type { Metadata } from 'next';

import { TemplateList } from '@/features/templates/components/template-list';

export const metadata: Metadata = {
  title: 'Treinos',
  robots: { index: false, follow: false },
};

export default function TreinosPage() {
  return <TemplateList />;
}
