import { z } from 'zod';

/**
 * Chamado de suporte.
 *
 * Só três coisas são obrigatórias — tipo, título e o que aconteceu. O print é
 * opcional porque quem está com raiva de um bug não deveria precisar aprender
 * a tirar screenshot antes de conseguir reclamar.
 */

export const TICKET_KINDS = [
  { value: 'erro', label: 'Algo deu errado' },
  { value: 'sugestao', label: 'Tenho uma sugestão' },
  { value: 'duvida', label: 'Tenho uma dúvida' },
  { value: 'outro', label: 'Outro assunto' },
] as const;

export const TICKET_STATUS = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'resolvido', label: 'Resolvido' },
  { value: 'fechado', label: 'Fechado' },
] as const;

/** O bucket recusa acima disso; avisar antes é melhor do que falhar depois. */
export const MAX_SCREENSHOT_BYTES = 3 * 1024 * 1024;

export const ticketSchema = z.object({
  kind: z.enum(TICKET_KINDS.map((item) => item.value) as [string, ...string[]]),
  title: z
    .string()
    .trim()
    .min(3, 'Escreva um título com pelo menos 3 caracteres')
    .max(120, 'O título pode ter até 120 caracteres'),
  body: z
    .string()
    .trim()
    .min(5, 'Conte o que aconteceu — pelo menos algumas palavras')
    .max(4000, 'O texto pode ter até 4000 caracteres'),
  page_url: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || null),
});

export const ticketAnswerSchema = z.object({
  status: z.enum(TICKET_STATUS.map((item) => item.value) as [string, ...string[]]),
  answer: z
    .string()
    .trim()
    .max(4000, 'A resposta pode ter até 4000 caracteres')
    .optional()
    .transform((value) => value || null),
});

export type TicketInput = z.infer<typeof ticketSchema>;
