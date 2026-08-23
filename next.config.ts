import type { NextConfig } from 'next';

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      ...(supabaseHost
        ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/**' }]
        : []),
      // avatares do Google, quando o usuário entra com conta Google
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  /**
   * Endereços antigos continuam funcionando.
   *
   * `/app` e `/treino/hoje` foram os nomes originais do painel e do cronômetro.
   * Quem instalou o PWA tem o atalho apontando para `/app`, e um link que morre
   * é pior do que um nome de rota ruim. O redirect é permanente porque o destino
   * novo é definitivo.
   */
  async redirects() {
    return [
      { source: '/app', destination: '/hoje', permanent: true },
      { source: '/app/:path*', destination: '/hoje/:path*', permanent: true },
      { source: '/treino/hoje', destination: '/treinar', permanent: true },
      // atalhos que as pessoas tentam digitar
      { source: '/treinar/agora', destination: '/treinar?auto=1', permanent: false },
      { source: '/agua', destination: '/saude', permanent: false },
      { source: '/entrar', destination: '/login', permanent: false },
      { source: '/criar-conta', destination: '/cadastro', permanent: false },
      { source: '/insignias', destination: '/conquistas', permanent: false },
      { source: '/suporte', destination: '/ajuda', permanent: false },
    ];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
