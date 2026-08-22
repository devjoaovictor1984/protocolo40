import type { ExerciseCategory } from '@/types/database';
import { daysBetween } from '@/services/calendar';

/**
 * Sugestão de foco para o treino de hoje.
 *
 * Olha o que foi trabalhado nos últimos dias e aponta o que anda de fora. É uma
 * observação sobre o histórico, não uma prescrição: nunca diz o que a pessoa
 * "deve" fazer, e nunca bloqueia nada.
 */

export type RecentDay = {
  day: string;
  categories: ExerciseCategory[];
};

/** Grupos que competem entre si na hora de variar o estímulo. */
const GROUPS = {
  superiores: ['peito', 'costas', 'ombros', 'bracos'] as ExerciseCategory[],
  inferiores: ['pernas'] as ExerciseCategory[],
  core: ['abdomen'] as ExerciseCategory[],
  cardio: ['cardio'] as ExerciseCategory[],
} as const;

export type FocusGroup = keyof typeof GROUPS;

const GROUP_LABELS: Record<FocusGroup, string> = {
  superiores: 'membros superiores',
  inferiores: 'pernas',
  core: 'core',
  cardio: 'cardio',
};

/** Tags de template que correspondem a cada grupo. */
const GROUP_TAGS: Record<FocusGroup, string[]> = {
  superiores: ['superiores'],
  inferiores: ['inferiores'],
  core: ['core'],
  cardio: ['cardio'],
};

export type Suggestion = {
  message: string;
  prefer: FocusGroup[];
  tags: string[];
};

function groupOf(category: ExerciseCategory): FocusGroup | null {
  for (const [group, categories] of Object.entries(GROUPS) as [FocusGroup, ExerciseCategory[]][]) {
    if (categories.includes(category)) return group;
  }
  return null;
}

/**
 * @param recent Dias com treino nos últimos tempos, com as categorias tocadas.
 * @param today  Dia de referência.
 * @param window Quantos dias para trás considerar.
 */
export function suggestFocus(recent: readonly RecentDay[], today: string, window = 3): Suggestion | null {
  const inWindow = recent.filter((entry) => {
    const distance = daysBetween(entry.day, today);
    return distance >= 0 && distance < window;
  });

  if (inWindow.length === 0) return null;

  const counts = new Map<FocusGroup, number>();
  for (const entry of inWindow) {
    for (const category of entry.categories) {
      const group = groupOf(category);
      if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
    }
  }

  if (counts.size === 0) return null;

  const groups = Object.keys(GROUPS) as FocusGroup[];
  const heaviest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const untouched = groups.filter((group) => (counts.get(group) ?? 0) === 0);

  // sem grupo dominante, não há o que observar
  if (heaviest[1] < 2 || untouched.length === 0) return null;

  const prefer = untouched.slice(0, 3);
  const list = prefer.map((group) => GROUP_LABELS[group]);
  const readable =
    list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} ou ${list[list.length - 1]}`;

  return {
    message: `Você trabalhou bastante ${GROUP_LABELS[heaviest[0]]} nos últimos dias. Hoje pode ser interessante priorizar ${readable}.`,
    prefer,
    tags: prefer.flatMap((group) => GROUP_TAGS[group]),
  };
}
