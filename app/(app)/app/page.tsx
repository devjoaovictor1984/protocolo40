import type { Metadata } from 'next';

import { Dashboard } from '@/features/dashboard/components/dashboard';

export const metadata: Metadata = {
  title: 'Hoje',
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <Dashboard />;
}
