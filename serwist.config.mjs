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
}));
