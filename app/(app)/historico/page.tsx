import { permanentRedirect } from 'next/navigation';

/**
 * O histórico mora no calendário.
 *
 * A lista continua existindo, logo abaixo do mês — ter as duas telas seria a
 * mesma informação em dois endereços. Este redirect existe para os links
 * antigos, que estão em favorito e em atalho de PWA.
 */
export default function HistoricoPage() {
  permanentRedirect('/calendario');
}
