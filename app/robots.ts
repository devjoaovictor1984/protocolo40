import type { MetadataRoute } from 'next';

import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // nada do produto em si é indexável: só a landing e perfis públicos
        disallow: [
          '/hoje',
          '/onboarding',
          '/treino/',
          '/treinos/',
          '/historico',
          '/calendario',
          '/evolucao',
          '/medidas',
          '/recordes',
          '/comunidade',
          '/perfil',
          '/configuracoes',
          '/api/',
          '/auth/',
        ],
      },
    ],
    sitemap: `${env.siteUrl}/sitemap.xml`,
  };
}
