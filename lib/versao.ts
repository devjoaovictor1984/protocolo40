/**
 * Versão do app que está rodando.
 *
 * Existe por causa do PWA: aberto no celular, ele fica dias na memória com o
 * JavaScript de um build velho. Cada deploy gera identificadores novos para as
 * Server Actions, e o botão antigo passa a chamar uma ação que o servidor não
 * reconhece — "Entrar no desafio" morria em silêncio, sem erro e sem inscrição.
 *
 * O valor é embutido no build pelo `next.config.ts`, no servidor e no cliente
 * juntos, então os dois lados de um mesmo deploy sempre concordam.
 */
export const VERSAO = process.env.NEXT_PUBLIC_VERSAO || 'dev';

/**
 * Telas onde recarregar sozinho atrapalha mais do que ajuda.
 *
 * O cronômetro sobrevive a um recarregamento (ele é por timestamp e mora no
 * IndexedDB), mas a pessoa vê a tela piscar no meio da série. A atualização
 * espera ela sair do treino.
 */
const NAO_RECARREGAR = ['/treinar', '/treino'];

/** Recarregar agora? Só com as duas versões conhecidas, diferentes, e fora do treino. */
export function precisaAtualizar(local: string, remota: string | null, pathname: string): boolean {
  if (!remota || local === 'dev' || remota === 'dev') return false;
  if (NAO_RECARREGAR.some((rota) => pathname === rota || pathname.startsWith(`${rota}/`))) {
    return false;
  }
  return local !== remota;
}
