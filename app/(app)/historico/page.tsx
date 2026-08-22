import type { Metadata } from 'next';

import { HistoryList } from '@/features/history/components/history-list';

export const metadata: Metadata = {
  title: 'Histórico',
  robots: { index: false, follow: false },
};

export default function HistoricoPage() {
  return <HistoryList />;
}
