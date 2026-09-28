/**
 * Demonstrações animadas dos exercícios: o mascote fazendo o movimento.
 *
 * Moram em `public/exercises/<slug>/` e não no banco, ao contrário do resto do
 * catálogo, por três motivos:
 *
 * - são arte do produto, entregue junto com o código — não conteúdo que o admin
 *   muda pelo painel (para isso existe `exercises.illustration_path`);
 * - o catálogo fica em cache no IndexedDB, e um caminho gravado ali envelheceria
 *   junto com ele; resolvido na hora pelo slug, o aparelho vê a arte nova no
 *   primeiro deploy, sem esperar o cache vencer;
 * - servidas da mesma origem, entram no cache de imagens do service worker na
 *   primeira vez que aparecem e passam a funcionar offline.
 *
 * A chave é o `slug` do exercício do sistema, o mesmo do seed. Exercício criado
 * pela pessoa não tem slug e, portanto, nunca tem demonstração.
 *
 * Para acrescentar uma: gere os arquivos com `scripts/demo-exercicio.mjs` e
 * registre aqui o slug com a largura e a altura que ele imprime.
 */

type DemoRegistrada = {
  /** Tamanho de `demo.webp`, para a janela reservar o espaço antes de a imagem chegar. */
  width: number;
  height: number;
};

const DEMOS: Record<string, DemoRegistrada> = {
  flexao: { width: 720, height: 418 },
  agachamento: { width: 429, height: 720 },
};

export type ExerciseDemoMedia = {
  /** Animação pequena, para a lista. */
  thumb: string;
  /** Animação grande, para quem abre a demonstração. */
  demo: string;
  /** Primeiro quadro parado, para quem pediu menos movimento no aparelho. */
  still: string;
  width: number;
  height: number;
};

export function getExerciseDemo(slug: string | null | undefined): ExerciseDemoMedia | null {
  if (!slug) return null;

  const registrada = DEMOS[slug];
  if (!registrada) return null;

  const pasta = `/exercises/${slug}`;
  return {
    thumb: `${pasta}/thumb.webp`,
    demo: `${pasta}/demo.webp`,
    still: `${pasta}/still.webp`,
    width: registrada.width,
    height: registrada.height,
  };
}

/** Slugs com demonstração — para o teste conferir que os arquivos existem. */
export const EXERCISE_DEMO_SLUGS = Object.keys(DEMOS);
