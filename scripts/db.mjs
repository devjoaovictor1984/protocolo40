#!/usr/bin/env node
/**
 * Atalho para o Supabase CLI usando as credenciais do `.env.local`.
 *
 * O CLI aceita `--db-url` e dispensa `supabase login`, que é interativo e não
 * roda em CI. A senha é montada aqui e percent-encoded, porque a nossa tem
 * caracteres que quebram uma connection string escrita à mão.
 *
 *   node scripts/db.mjs push          aplica as migrations pendentes
 *   node scripts/db.mjs push --include-seed
 *   node scripts/db.mjs diff          compara o schema local com o remoto
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const ENV_FILE = '.env.local';

if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;

if (!ref || !password) {
  console.error(
    `Faltam SUPABASE_PROJECT_REF e SUPABASE_DB_PASSWORD no ${ENV_FILE}.\n` +
      'Copie de .env.example e preencha com os dados do seu projeto.',
  );
  process.exit(1);
}

const dbUrl = `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
const [command, ...rest] = process.argv.slice(2);

if (!command) {
  console.error('Informe um comando: push, diff, dump…');
  process.exit(1);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['supabase', 'db', command, '--db-url', dbUrl, ...rest],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
