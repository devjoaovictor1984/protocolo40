import type { Metadata } from 'next';

import { MonthCalendar } from '@/features/calendar/components/month-calendar';

export const metadata: Metadata = {
  title: 'Calendário',
  robots: { index: false, follow: false },
};

export default function CalendarioPage() {
  return <MonthCalendar />;
}
