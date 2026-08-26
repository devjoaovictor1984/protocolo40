import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'P20X',
    short_name: 'P20X',
    description: '20 minutos. Todos os dias. Treine, registre e acompanhe sua evolução.',
    lang: 'pt-BR',
    dir: 'ltr',
    // o app instalado abre direto no dashboard, não na landing
    start_url: '/hoje',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#15171c',
    theme_color: '#15171c',
    categories: ['health', 'fitness', 'lifestyle'],
    // arquivos estáticos, e não a rota que desenhava o ícone por código: agora
    // existe arte de verdade, e servir do CDN é mais rápido que renderizar
    icons: [
      { src: '/icons/96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Começar treino',
        short_name: 'Treinar',
        description: 'Abrir o cronômetro e começar os 20 minutos de hoje',
        url: '/treinar',
      },
      {
        name: 'Registrar peso',
        short_name: 'Peso',
        url: '/medidas',
      },
    ],
  };
}
