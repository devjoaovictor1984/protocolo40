import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist';

import {
  CACHES_ANTIGOS,
  CACHES_DE_SESSAO,
  LIMPAR_SESSAO,
  ehConteudoAssinado,
  ehRotaDeAutenticacao,
  podeAbrirOffline,
  respostaEhGuardavel,
} from '../lib/offline/cache-policy';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Recusa o que não for a página pedida. A regra está em `cache-policy`. */
const somenteRespostaReal = {
  cacheWillUpdate: async ({ response }: { response: Response }) =>
    respostaEhGuardavel(response) ? response : null,
};

/**
 * Service worker do P20X.
 *
 * A regra que organiza tudo: o que é necessário para treinar precisa abrir sem
 * rede; o que é social ou sensível nunca entra em cache.
 *
 * As regras de página vêm escritas aqui uma a uma, e não do `defaultCache` do
 * Serwist. O padrão dele guarda todo HTML e todo payload RSC da origem —
 * inclusive `/perfil`, `/comunidade` e `/saude`, que são de uma pessoa só e
 * ficariam legíveis no disco para o próximo dono do aparelho.
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && ehRotaDeAutenticacao(url.pathname),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url }) => ehConteudoAssinado(url),
      handler: new NetworkOnly(),
    },
    {
      // O treino é a funcionalidade crítica: tenta a rede por 3 segundos e cai
      // para o cache. Melhor uma tela levemente antiga do que nenhuma tela.
      //
      // É o único conteúdo de sessão que guardamos, e some quando a pessoa sai.
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin && request.mode === 'navigate' && podeAbrirOffline(url.pathname),
      handler: new NetworkFirst({
        cacheName: CACHES_DE_SESSAO[0],
        networkTimeoutSeconds: 3,
        plugins: [
          somenteRespostaReal,
          new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 7 }),
        ],
      }),
    },
    {
      // Qualquer outra página ou payload RSC vai direto à rede. São telas de
      // uma pessoa só, e uma tela offline vale menos que uma sessão que dura.
      matcher: ({ request, sameOrigin }) =>
        sameOrigin && (request.mode === 'navigate' || request.headers.get('RSC') === '1'),
      handler: new NetworkOnly(),
    },

    // --- daqui para baixo, só arquivo estático: não tem dono e não tem sessão ---
    {
      matcher: /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      handler: new CacheFirst({
        cacheName: 'p20x-fontes',
        plugins: [new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 })],
      }),
    },
    {
      matcher: /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      handler: new StaleWhileRevalidate({ cacheName: 'p20x-fontes-css' }),
    },
    {
      matcher: /\/_next\/static\/.+/i,
      handler: new CacheFirst({
        cacheName: 'p20x-estaticos',
        plugins: [new ExpirationPlugin({ maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
    {
      // Thumbnails já assinadas e renderizadas pelo Next: leves e reutilizadas
      // no calendário e no histórico.
      matcher: ({ url, request }) =>
        request.destination === 'image' && url.pathname.startsWith('/_next/image'),
      handler: new CacheFirst({
        cacheName: 'p20x-thumbs',
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
      }),
    },
    {
      matcher: ({ request, sameOrigin }) =>
        sameOrigin && ['image', 'font', 'style', 'script'].includes(request.destination),
      handler: new StaleWhileRevalidate({ cacheName: 'p20x-assets' }),
    },
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

/**
 * Faxina de instalação: apaga o que a versão anterior guardou.
 *
 * Quem já usa o app tem no aparelho os caches do `defaultCache` — e possivelmente
 * a tela de login guardada sob a chave de `/hoje`. Sem esta limpeza, a correção
 * não chega em quem estava sofrendo com o problema.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes.filter((nome) => CACHES_ANTIGOS.includes(nome)).map((nome) => caches.delete(nome)),
        ),
      ),
  );
});

/**
 * Sair da conta apaga a página guardada.
 *
 * O `wipeLocalData()` limpa o IndexedDB, mas o HTML de `/hoje` fica aqui — e o
 * próximo a abrir o app no mesmo aparelho veria o nome e a sequência de quem
 * saiu, antes de a rede responder.
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | null)?.type !== LIMPAR_SESSAO) return;

  event.waitUntil(Promise.all(CACHES_DE_SESSAO.map((nome) => caches.delete(nome))));
});

/**
 * Notificação recebida.
 *
 * O corpo vem como JSON do servidor. Se vier quebrado — versão antiga do app,
 * envio de outro lugar — ainda assim algo aparece: uma notificação que o
 * navegador prometeu mostrar e não mostra faz o Chrome exibir "Este site foi
 * atualizado em segundo plano", que é pior do que qualquer texto nosso.
 */
self.addEventListener('push', (event) => {
  const conteudo = (() => {
    try {
      return event.data?.json() as { title?: string; body?: string; url?: string; tag?: string };
    } catch {
      return {};
    }
  })();

  const titulo = conteudo.title ?? 'P20X';

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: conteudo.body ?? 'Seus 20 minutos estão esperando.',
      icon: '/icons/192',
      badge: '/icons/badge',
      // agrupa por assunto: dois dias sem abrir o app não viram dois avisos
      tag: conteudo.tag ?? 'p20x',
      data: { url: conteudo.url ?? '/hoje' },
      // `renotify` faz o aviso repetido vibrar em vez de trocar em silêncio;
      // ainda não está na tipagem do DOM, daí o molde
      renotify: true,
    } as NotificationOptions & { renotify: boolean }),
  );
});

/**
 * Toque na notificação.
 *
 * Reaproveita uma janela aberta em vez de abrir outra: quem já está com o app
 * aberto não quer uma segunda cópia dele. Só abre nova se não houver nenhuma.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const destino = (event.notification.data as { url?: string } | undefined)?.url ?? '/hoje';
  const alvo = new URL(destino, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin) {
          await janela.focus();
          if ('navigate' in janela) await janela.navigate(alvo);
          return;
        }
      }

      await self.clients.openWindow(alvo);
    })(),
  );
});

/**
 * O serviço de push renovou a inscrição por conta própria.
 *
 * Acontece de tempos em tempos, e sem tratar isto o aparelho para de receber em
 * silêncio. O app não tem sessão aqui dentro, então a rota confia no `endpoint`
 * antigo para achar de quem era.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  const evento = event as ExtendableEvent & {
    oldSubscription?: PushSubscription | null;
    newSubscription?: PushSubscription | null;
  };

  event.waitUntil(
    (async () => {
      const nova =
        evento.newSubscription ??
        (await self.registration.pushManager.getSubscription().catch(() => null));

      if (!nova) return;

      await fetch('/api/push/renovar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          antigo: evento.oldSubscription?.endpoint ?? null,
          nova: nova.toJSON(),
        }),
      }).catch(() => {
        // sem rede agora: a próxima abertura do app reinscreve
      });
    })(),
  );
});

serwist.addEventListeners();
