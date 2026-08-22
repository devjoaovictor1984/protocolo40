import type { MetadataRoute } from 'next';

import { env } from '@/lib/env';

/**
 * Só rotas públicas. Perfis entram aqui na Fase 4, e apenas quando o usuário
 * marcar o perfil como público.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${env.siteUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${env.siteUrl}/cadastro`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${env.siteUrl}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];
}
