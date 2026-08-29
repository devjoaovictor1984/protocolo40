import { z } from 'zod';

/**
 * Schema da meta de peso, compartilhado entre formulário e Server Action.
 *
 * O intervalo de 30 a 400 kg é o mesmo do `check` em `weight_goals`: o
 * formulário recusa antes de ir à rede, e o banco recusa de novo se alguém
 * chamar a API por fora. O piso de verdade — o que depende da altura — não cabe
 * aqui, porque este schema não conhece o perfil; ele mora em
 * `avaliarAlvo()` e no gatilho `weight_goals_piso`.
 */
export const metaDePesoSchema = z.object({
  target_kg: z
    .union([z.string(), z.number()])
    .transform((valor) =>
      typeof valor === 'number' ? valor : Number(String(valor).trim().replace(',', '.')),
    )
    .refine((valor) => Number.isFinite(valor), 'Informe o peso que você quer alcançar')
    .refine((valor) => valor >= 30 && valor <= 400, 'O peso alvo precisa ficar entre 30 e 400 kg')
    // o banco guarda numeric(5,2); arredondar aqui evita 72.33333 na tela
    .transform((valor) => Math.round(valor * 100) / 100),
});

export type MetaDePesoInput = z.input<typeof metaDePesoSchema>;
