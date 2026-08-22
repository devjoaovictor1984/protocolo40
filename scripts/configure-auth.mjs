#!/usr/bin/env node
/**
 * Configura o Auth do Supabase pela Management API.
 *
 * Faz o que seria feito à mão no painel: liga o provedor Google e registra as
 * URLs de redirecionamento. É idempotente — rodar de novo só reaplica o mesmo
 * estado.
 *
 * Precisa de um access token pessoal, criado em
 * https://supabase.com/dashboard/account/tokens
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-auth.mjs
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-auth.mjs --site-url https://protocolo40.vercel.app
 *
 * O client id e o secret do Google saem do JSON baixado do Google Cloud, cujo
 * caminho vem de GOOGLE_CLIENT_SECRET_FILE — o secret nunca precisa ser digitado
 * nem colado em lugar nenhum.
 */

import { readFileSync, existsSync } from 'node:fs';

if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local');
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;

if (!token) {
  console.error(
    'Falta SUPABASE_ACCESS_TOKEN.\n' +
      'Crie um em https://supabase.com/dashboard/account/tokens e rode:\n' +
      '  SUPABASE_ACCESS_TOKEN=sbp_... node scripts/configure-auth.mjs',
  );
  process.exit(1);
}

if (!ref) {
  console.error('Falta SUPABASE_PROJECT_REF no .env.local.');
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const siteUrl = flag('site-url') ?? 'http://localhost:3000';

/** URLs para onde o Supabase pode devolver o usuário depois do login. */
const redirectUrls = [
  'http://localhost:3000/auth/callback',
  'http://localhost:3000/**',
  ...(siteUrl.startsWith('http://localhost')
    ? []
    : [`${siteUrl.replace(/\/$/, '')}/auth/callback`, `${siteUrl.replace(/\/$/, '')}/**`]),
  ...(flag('extra-redirect') ? [flag('extra-redirect')] : []),
];

const config = {
  site_url: siteUrl,
  uri_allow_list: redirectUrls.join(','),
};

// O Google é opcional: sem o JSON, só as URLs são configuradas.
const googleFile = process.env.GOOGLE_CLIENT_SECRET_FILE;

if (googleFile) {
  if (!existsSync(googleFile)) {
    console.error(`Não encontrei o arquivo do Google em ${googleFile}`);
    process.exit(1);
  }

  const json = JSON.parse(readFileSync(googleFile, 'utf8'));
  const web = json.web ?? json.installed;

  if (!web?.client_id || !web?.client_secret) {
    console.error('O JSON do Google não tem client_id e client_secret. Baixe a credencial Web.');
    process.exit(1);
  }

  const expected = `https://${ref}.supabase.co/auth/v1/callback`;
  if (!(web.redirect_uris ?? []).includes(expected)) {
    console.error(`A credencial do Google não tem o redirect ${expected}. Adicione no Google Cloud.`);
    process.exit(1);
  }

  config.external_google_enabled = true;
  config.external_google_client_id = web.client_id;
  config.external_google_secret = web.client_secret;
}

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(config),
});

if (!response.ok) {
  console.error(`Falhou (${response.status}): ${await response.text()}`);
  process.exit(1);
}

const result = await response.json();

console.log('Auth configurado:');
console.log('  site_url        ', result.site_url);
console.log('  redirect urls   ', (result.uri_allow_list ?? '').split(',').join('\n                   '));
console.log('  google          ', result.external_google_enabled ? 'ligado' : 'desligado');
console.log('  confirmar e-mail', result.mailer_autoconfirm ? 'desligado (entra direto)' : 'ligado');
