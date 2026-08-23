/**
 * Analytics e pixel.
 *
 * Duas decisões que valem mais que a instalação em si.
 *
 * **Nenhum identificador vai junto.** As telas privadas deste app têm o id do
 * treino, o nome de usuário e a data no próprio endereço. Mandar o caminho cru
 * para o Google ou para a Meta entregaria a terceiros o que o usuário guardou
 * aqui achando que era privado. Por isso todo caminho passa por `caminhoSeguro`
 * antes de sair, e o que é identificável vira um marcador genérico.
 *
 * **Só carrega se estiver configurado.** Sem as variáveis, nenhum script é
 * baixado — nem em desenvolvimento, nem em preview. Um deploy de teste não
 * contamina os números do deploy real.
 */

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim() || null;
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || null;

export const analyticsAtivo = Boolean(GA_ID || META_PIXEL_ID);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Troca o que identifica alguém por um marcador.
 *
 *   /treino/9f8c…-…      → /treino/[id]
 *   /u/joaovictor        → /u/[usuario]
 *   /admin/usuarios/9f8… → /admin/usuarios/[id]
 *
 * A query string inteira é descartada: `?data=2026-08-07` é informação de
 * saúde, e nenhum relatório de audiência precisa dela.
 */
export function caminhoSeguro(caminho: string): string {
  const [semQuery] = caminho.split('?');
  const partes = semQuery.split('/');

  return partes
    .map((parte, indice) => {
      if (!parte) return parte;
      if (UUID.test(parte) || DATA.test(parte)) return '[id]';
      // o segmento depois de /u/ é o nome de usuário público
      if (indice > 0 && partes[indice - 1] === 'u') return '[usuario]';
      return parte;
    })
    .join('/');
}

/**
 * Eventos que valem a pena medir.
 *
 * Só marcos de funil, e nenhum deles carrega peso, medida, foto ou qualquer
 * outro dado de saúde — apenas que a ação aconteceu.
 */
export type EventoAnalytics =
  | 'cadastro_concluido'
  | 'onboarding_concluido'
  | 'treino_iniciado'
  | 'treino_concluido'
  | 'dias_anteriores_registrados'
  | 'treino_proprio_criado'
  | 'chamado_enviado';
