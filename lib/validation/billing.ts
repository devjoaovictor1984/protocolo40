import { z } from 'zod';

/**
 * Plano, do jeito que o admin edita.
 *
 * O preço é digitado em reais porque é assim que se pensa nele; a conversão
 * para centavos acontece na ação. Guardar centavos no banco é o que evita o
 * erro clássico de somar 0,1 + 0,2 em ponto flutuante e cobrar errado.
 */

export const INTERVALOS = [
  { value: 'mes', label: 'Por mês' },
  { value: 'ano', label: 'Por ano' },
  { value: 'vitalicio', label: 'Pagamento único' },
] as const;

export const RECURSOS_DISPONIVEIS = [
  { value: 'analise', label: 'Análise do treino' },
  { value: 'saude', label: 'Saúde e metas' },
  { value: 'video', label: 'Vídeo de evolução' },
] as const;

export const planoSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{2,30}$/, 'Use letras minúsculas, números e hífen'),
  name: z.string().trim().min(2, 'Dê um nome ao plano').max(60, 'O nome pode ter até 60 caracteres'),
  tagline: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((valor) => valor || null),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((valor) => valor || null),
  price_reais: z
    .union([z.string(), z.number()])
    .transform((valor) =>
      typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.')),
    )
    .refine((valor) => Number.isFinite(valor) && valor >= 0, 'Informe um preço válido')
    .refine((valor) => valor <= 100000, 'Preço fora do intervalo esperado'),
  interval: z.enum(['mes', 'ano', 'vitalicio']),
  stripe_price_id: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((valor) => valor || null)
    .refine(
      (valor) => valor === null || valor.startsWith('price_'),
      'O identificador do Stripe começa com "price_"',
    ),
  features: z.array(z.enum(['analise', 'saude', 'video'])).default([]),
  is_active: z.boolean().default(true),
});

export type PlanoInput = z.infer<typeof planoSchema>;
