import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Um módulo `'use server'` só pode exportar funções assíncronas.
 *
 * Exportar um objeto dali passa no build e no `tsc`, e só quebra quando o
 * formulário é enviado — com uma tela de erro genérica no lugar da ação. Foi
 * exatamente o que aconteceu com o onboarding em produção: `idleState` era um
 * objeto exportado de um arquivo de action.
 *
 * Este teste lê os arquivos e reprova qualquer export que não seja
 * `export async function`.
 */

/** Percorre as pastas de código à procura de arquivos TypeScript. */
function walk(directory: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...walk(path));
    } else if (/\.tsx?$/.test(entry.name)) {
      found.push(path);
    }
  }

  return found;
}

const serverModules = ['app', 'features', 'lib', 'services']
  .flatMap((directory) => walk(directory))
  .filter((file) => /^\s*['"]use server['"]/.test(readFileSync(file, 'utf8')));

/** Qualquer `export` que não seja de função assíncrona ou de tipo. */
function offendingExports(source: string): string[] {
  const offenders: string[] = [];
  const lines = source.split('\n');

  for (const [index, line] of lines.entries()) {
    if (!/^export\b/.test(line)) continue;

    const isAsyncFunction = /^export async function \w+/.test(line);
    // `export type` e `export interface` somem na compilação, então são seguros
    const isTypeOnly = /^export (type|interface) \b/.test(line);

    if (!isAsyncFunction && !isTypeOnly) {
      offenders.push(`linha ${index + 1}: ${line.trim()}`);
    }
  }

  return offenders;
}

describe("módulos 'use server'", () => {
  it('existem para serem verificados', () => {
    expect(serverModules.length).toBeGreaterThan(0);
  });

  it.each(serverModules)('%s só exporta funções assíncronas', (file) => {
    const offenders = offendingExports(readFileSync(file, 'utf8'));

    expect(
      offenders,
      `${file} exporta algo que não é função assíncrona. ` +
        'Mova constantes e tipos para um módulo normal — o Next recusa o módulo inteiro em tempo de execução.',
    ).toEqual([]);
  });
});
