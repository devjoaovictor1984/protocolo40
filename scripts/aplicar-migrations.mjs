#!/usr/bin/env node
/**
 * Aplica as migrations pendentes falando direto com o Postgres.
 *
 * Existe porque `supabase db push` fica mudo e não aplica nada quando roda sem
 * terminal interativo — que é o caso aqui e em qualquer CI. Este script faz o
 * mesmo trabalho e é verificável: lista o que falta, aplica em ordem e registra
 * em `supabase_migrations.schema_migrations`, exatamente como o CLI.
 *
 *   node scripts/aplicar-migrations.mjs            mostra o que falta
 *   node scripts/aplicar-migrations.mjs --aplicar  aplica
 *
 * Cada arquivo roda na própria transação. Isso importa: um `alter type ... add
 * value` não pode ser usado na mesma transação em que foi criado, e é por isso
 * que a métrica nova de insígnia mora num arquivo separado do seed.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

process.loadEnvFile('.env.local');

const DIR = 'supabase/migrations';
const aplicar = process.argv.includes('--aplicar');

const ref = process.env.SUPABASE_PROJECT_REF;
const senha = process.env.SUPABASE_DB_PASSWORD;

if (!ref || !senha) {
  console.error('Faltam SUPABASE_PROJECT_REF e SUPABASE_DB_PASSWORD no .env.local.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(senha)}@db.${ref}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const { rows } = await client.query('select version from supabase_migrations.schema_migrations');
const aplicadas = new Set(rows.map((r) => r.version));

const arquivos = readdirSync(DIR)
  .filter((nome) => nome.endsWith('.sql'))
  .sort()
  .map((nome) => {
    const [, version, name] = nome.match(/^(\d+)_(.+)\.sql$/) ?? [];
    return { nome, version, name };
  })
  .filter((m) => m.version && !aplicadas.has(m.version));

if (arquivos.length === 0) {
  console.log('Nada pendente.');
  await client.end();
  process.exit(0);
}

console.log(`${arquivos.length} migration(s) pendente(s):`);
for (const m of arquivos) console.log(`  ${m.version}  ${m.name}`);

if (!aplicar) {
  console.log('\nRode com --aplicar para aplicar.');
  await client.end();
  process.exit(0);
}

for (const m of arquivos) {
  const sql = readFileSync(join(DIR, m.nome), 'utf8');
  process.stdout.write(`\n${m.version} ${m.name} ... `);

  try {
    await client.query('begin');
    await client.query(sql);
    await client.query(
      'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)',
      [m.version, m.name, [sql]],
    );
    await client.query('commit');
    console.log('ok');
  } catch (erro) {
    await client.query('rollback');
    console.log('FALHOU');
    console.error(`\n${erro.message}\n`);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log('\nPronto.');
