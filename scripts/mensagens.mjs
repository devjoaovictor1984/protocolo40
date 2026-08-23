#!/usr/bin/env node
/**
 * Gera a migration da mensagem do dia.
 *
 * As referências e as mensagens são nossas; o texto do versículo vem da API
 * pública `bible-api.com`, na tradução João Ferreira de Almeida, que é de
 * domínio público. Buscar em vez de digitar é o que garante que a citação
 * esteja certa — errar um versículo é pior do que não citar nenhum.
 *
 * A busca acontece aqui, uma vez, e o resultado vira seed. Em produção o app
 * nunca depende de uma API de terceiros: a mensagem do dia sai do banco, e
 * funciona offline como todo o resto.
 *
 *   node scripts/mensagens.mjs            gera a migration
 *   node scripts/mensagens.mjs --check    só valida as referências
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = 'scripts/data';
const SAIDA = 'supabase/migrations/20260825100000_mensagem_do_dia.sql';
const API = 'https://bible-api.com';
/** A API é gratuita e limita o ritmo; ir devagar é o que faz terminar. */
const CONCORRENCIA = 2;
const PAUSA_MS = 200;
const CACHE = join(PASTA, 'versiculos.json');

const soChecar = process.argv.includes('--check');

/** Junta os arquivos de dados na ordem dos nomes. */
function carregar() {
  const arquivos = readdirSync(PASTA)
    .filter((nome) => /^mensagens-\d+\.json$/.test(nome))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

  return arquivos.flatMap((nome) => JSON.parse(readFileSync(join(PASTA, nome), 'utf8')));
}

/**
 * Cache em disco.
 *
 * Refazer a migration não deveria bater 365 vezes numa API gratuita. O que já
 * foi buscado uma vez fica guardado e é reaproveitado.
 */
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

async function buscarVersiculo(referencia) {
  if (cache[referencia]) return cache[referencia];

  const url = `${API}/${encodeURIComponent(referencia)}?translation=almeida`;

  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    try {
      await new Promise((r) => setTimeout(r, PAUSA_MS));
      const resposta = await fetch(url);

      if (resposta.status === 429 || resposta.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000 * (tentativa + 1)));
        continue;
      }

      if (!resposta.ok) return { erro: `HTTP ${resposta.status}` };

      const dados = await resposta.json();
      const texto = String(dados.text ?? '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!texto) return { erro: 'sem texto' };

      // a API devolve a referência normalizada; usar a dela evita divergência
      const resultado = { texto, referencia: String(dados.reference ?? referencia).trim() };
      cache[referencia] = resultado;
      return resultado;
    } catch (erro) {
      if (tentativa === 5) return { erro: erro.message };
      await new Promise((r) => setTimeout(r, 1000 * (tentativa + 1)));
    }
  }

  return { erro: 'esgotou as tentativas' };
}

/** Escapa aspas simples para o literal SQL. */
const sql = (texto) => texto.replace(/'/g, "''");

async function main() {
  const entradas = carregar();
  console.log(`${entradas.length} mensagens para resolver.`);

  const resolvidas = new Array(entradas.length);
  const falhas = [];
  let proxima = 0;
  let feitas = 0;

  async function trabalhador() {
    while (proxima < entradas.length) {
      const indice = proxima;
      proxima += 1;

      const [referencia, tema, mensagem] = entradas[indice];
      const resultado = await buscarVersiculo(referencia);

      if (resultado.erro) {
        falhas.push(`${referencia}: ${resultado.erro}`);
      } else {
        resolvidas[indice] = {
          dia: indice + 1,
          referencia: resultado.referencia,
          versiculo: resultado.texto,
          tema,
          mensagem,
        };
      }

      feitas += 1;
      if (feitas % 50 === 0) console.log(`  ${feitas}/${entradas.length}`);
    }
  }

  await Promise.all(Array.from({ length: CONCORRENCIA }, trabalhador));

  writeFileSync(CACHE, JSON.stringify(cache, null, 0), 'utf8');

  if (falhas.length > 0) {
    console.error(`\n${falhas.length} referências não resolveram:`);
    for (const falha of falhas) console.error('  ' + falha);
    process.exit(1);
  }

  const validas = resolvidas.filter(Boolean);
  console.log(`\nTodas as ${validas.length} referências resolveram.`);

  if (soChecar) return;

  if (validas.length < 366) {
    console.error(`Faltam mensagens: ${validas.length} de 366 dias.`);
    process.exit(1);
  }

  const linhas = validas
    .slice(0, 366)
    .map(
      (item) =>
        `  (${item.dia}, '${sql(item.referencia)}', '${sql(item.versiculo)}', '${sql(item.tema)}', '${sql(item.mensagem)}')`,
    )
    .join(',\n');

  const conteudo = `-- =============================================================================
-- P20X · mensagem do dia
--
-- Uma para cada dia do ano, com versículo e uma frase que liga o texto ao
-- treino. O versículo vem da tradução João Ferreira de Almeida, que é de
-- domínio público, buscado de \`bible-api.com\` por \`scripts/mensagens.mjs\` —
-- citar de memória seria o jeito mais fácil de errar.
--
-- A escolha do dia é determinística: todo mundo vê a mesma mensagem no mesmo
-- dia, o que faz dela assunto em comum. E como mora no banco, não depende de
-- nenhuma API de terceiros estar no ar.
--
-- Gerado. Para refazer: \`node scripts/mensagens.mjs\`.
-- =============================================================================

create table if not exists public.daily_messages (
  day_of_year smallint primary key check (day_of_year between 1 and 366),
  reference   text not null,
  verse       text not null,
  theme       text not null,
  message     text not null
);

alter table public.daily_messages enable row level security;

-- leitura livre: a mensagem do dia também aparece para quem ainda não entrou
create policy "mensagem do dia leitura" on public.daily_messages
  for select to anon, authenticated using (true);

insert into public.daily_messages (day_of_year, reference, verse, theme, message) values
${linhas}
on conflict (day_of_year) do update
  set reference = excluded.reference,
      verse = excluded.verse,
      theme = excluded.theme,
      message = excluded.message;
`;

  writeFileSync(SAIDA, conteudo, 'utf8');
  console.log(`Migration escrita em ${SAIDA}.`);
}

await main();
