import { serwist } from '@serwist/next/config';

/**
 * Build do service worker.
 *
 * Roda como passo próprio depois do `next build` (veja o script `build`), e não
 * como plugin de bundler: a partir do Next 16 o Turbopack é o padrão, e o
 * caminho de plugin do Serwist ainda depende de webpack.
 *
 * O `withNextConfig` lê a configuração já resolvida do Next para descobrir o
 * diretório de saída e montar a lista de precache.
 */
export default serwist.withNextConfig(() => ({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  /**
   * A landing sai do precache.
   *
   * Guardada, ela era servida do cache antes de a requisição chegar ao
   * servidor — e o proxy nunca chegava a mandar para o painel quem já está
   * logado. Ninguém precisa da página de apresentação sem internet: não dá
   * para criar conta offline.
   *
   * Sai por aqui, e não por `manifestTransforms`: os transforms do usuário
   * rodam antes dos do Serwist, quando a entrada ainda é o caminho do arquivo
   * e não a rota. Filtrar por `'/'` ali não acha nada.
   */
  globIgnores: ['.next/server/app/index.html'],
}));
