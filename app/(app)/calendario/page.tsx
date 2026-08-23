import type { Metadata } from 'next';

import { MonthCalendar } from '@/features/calendar/components/month-calendar';
import { HistoryList } from '@/features/history/components/history-list';

export const metadata: Metadata = {
  title: 'Calendário',
  robots: { index: false, follow: false },
};

/**
 * Calendário e histórico na mesma tela.
 *
 * O mês vem primeiro porque é o que responde à pergunta que se faz todo dia
 * — "quantos dias eu já marquei?" — em um olhar. A lista continua logo
 * abaixo, para quando a pergunta é sobre um treino específico.
 */
export default function CalendarioPage() {
  return (
    <>
      <MonthCalendar comLista />
      <HistoryList embutido />
    </>
  );
}
