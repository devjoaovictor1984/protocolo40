import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'P20X',
    short_name: 'P20X',
    description: '20 minutos. Todos os dias. Treine, registre e acompanhe sua evolução.',
    lang: 'pt-BR',
    dir: 'ltr',
    /**
     * `id` fixa a identidade do app.
     *
     * Sem ele, o Chrome usa a `start_url` como identidade — e no dia em que a
     * `start_url` mudar, o aparelho passa a tratar como se fosse outro app:
     * instala um segundo ícone em vez de atualizar o que já existe.
     */
    id: '/',
    // o app instalado abre direto no dashboard, não na landing
    start_url: '/hoje',
    scope: '/',
    display: 'standalone',
    // navegador é o último recurso; a ordem diz o que preferir antes disso
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'portrait',
    background_color: '#15171c',
    theme_color: '#15171c',
    categories: ['health', 'fitness', 'lifestyle'],
    /**
     * Capturas de tela.
     *
     * Não são enfeite: com elas o Chrome do Android mostra a caixa de
     * instalação rica — nome, ícone e prévia, com o botão "Instalar" em
     * destaque. Sem elas, ele cai na barra mínima, que é a que muita gente
     * confunde com "criar atalho" e sai sem instalar nada.
     *
     * Uma por formato: o Chrome escolhe pelo `form_factor`.
     */
    screenshots: [
      {
        src: '/marca/tela-celular.webp',
        sizes: '412x915',
        type: 'image/webp',
        form_factor: 'narrow',
        label: 'A tela de hoje, com o treino e a sequência',
      },
      {
        src: '/marca/tela-desktop.webp',
        sizes: '1280x800',
        type: 'image/webp',
        form_factor: 'wide',
        label: 'O P20X no computador',
      },
    ],
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
