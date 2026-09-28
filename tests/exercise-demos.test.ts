import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { EXERCISE_DEMO_SLUGS, getExerciseDemo } from '@/features/exercises/demos';

/**
 * A demonstração é registrada à mão, e os arquivos são gerados à parte. O erro
 * que isto pega é o registro sem arquivo: a miniatura quebrada no cartão, em
 * produção, sem nada no build reclamar.
 */
describe('demonstrações dos exercícios', () => {
  it('exercício sem slug ou sem arte não tem demonstração', () => {
    expect(getExerciseDemo(null)).toBeNull();
    expect(getExerciseDemo(undefined)).toBeNull();
    expect(getExerciseDemo('exercicio-que-nao-existe')).toBeNull();
  });

  it('monta os três caminhos a partir do slug', () => {
    expect(getExerciseDemo('flexao')).toMatchObject({
      thumb: '/exercises/flexao/thumb.webp',
      demo: '/exercises/flexao/demo.webp',
      still: '/exercises/flexao/still.webp',
    });
  });

  it('exercício que é o mesmo movimento usa os arquivos do outro', () => {
    expect(getExerciseDemo('escalador')).toEqual(getExerciseDemo('mountain-climber'));
    expect(getExerciseDemo('escalador')?.demo).toBe('/exercises/mountain-climber/demo.webp');
  });

  it.each(EXERCISE_DEMO_SLUGS)('%s tem os três arquivos em public/', (slug) => {
    const demo = getExerciseDemo(slug)!;
    for (const caminho of [demo.thumb, demo.demo, demo.still]) {
      expect(existsSync(join('public', caminho)), caminho).toBe(true);
    }
  });

  it('as animações ficam fora do precache do service worker', () => {
    // no precache, instalar o app baixaria a arte de todos os exercícios
    expect(readFileSync('serwist.config.mjs', 'utf8')).toContain("'public/exercises/**'");
  });
});
