import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Service worker do P20X.
 *
 * A regra que organiza tudo: o que é necessário para treinar precisa abrir sem
 * rede; o que é social ou sensível nunca entra em cache.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // O treino é a funcionalidade crítica: tenta a rede por 3 segundos e cai
      // para o cache. Melhor uma tela levemente antiga do que nenhuma tela.
      matcher: ({ request, url }) =>
        request.mode === 'navigate' &&
        ['/hoje', '/treino', '/treinos'].some(
          (path) => url.pathname === path || url.pathname.startsWith(`${path}/`),
        ),
      handler: new NetworkFirst({
        cacheName: 'p40-treino',
        networkTimeoutSeconds: 3,
        plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 7 })],
      }),
    },
    {
      // Signed URLs expiram em 5 minutos e apontam para foto de corpo.
      // Guardar em cache seria vazar conteúdo privado no disco do aparelho.
      matcher: ({ url }) =>
        url.pathname.startsWith('/api/') ||
        url.searchParams.has('token') ||
        url.pathname.includes('/storage/v1/object/sign/'),
      handler: new NetworkOnly(),
    },
    {
      // Thumbnails já assinadas e renderizadas pelo Next: leves e reutilizadas
      // no calendário e no histórico.
      matcher: ({ url, request }) =>
        request.destination === 'image' && url.pathname.startsWith('/_next/image'),
      handler: new CacheFirst({
        cacheName: 'p40-thumbs',
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher: ({ request }) => request.mode === 'navigate',
      },
    ],
  },
});

serwist.addEventListeners();
