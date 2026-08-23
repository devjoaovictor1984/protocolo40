import { z } from 'zod';

/** Schemas de perfil, compartilhados entre formulário e Server Action. */

export const GOALS = [
  { value: 'perder_gordura', label: 'Perder gordura' },
  { value: 'ganhar_forca', label: 'Ganhar força' },
  { value: 'condicionamento', label: 'Melhorar condicionamento' },
  { value: 'ganhar_massa', label: 'Ganhar massa' },
  { value: 'melhorar_shape', label: 'Melhorar o shape' },
  { value: 'criar_disciplina', label: 'Criar disciplina' },
  { value: 'manter_saude', label: 'Manter a saúde' },
  { value: 'outro', label: 'Outro' },
] as const;

export const LEVELS = [
  { value: 'iniciante', label: 'Iniciante', hint: 'Estou começando agora' },
  { value: 'intermediario', label: 'Intermediário', hint: 'Já treino com alguma regularidade' },
  { value: 'avancado', label: 'Avançado', hint: 'Treino há anos' },
] as const;

export const PLACES = [
  { value: 'casa', label: 'Casa' },
  { value: 'academia', label: 'Academia' },
  { value: 'externa', label: 'Área externa' },
  { value: 'misto', label: 'Misto' },
] as const;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'O nome de usuário precisa de pelo menos 3 caracteres')
  .max(20, 'O nome de usuário pode ter até 20 caracteres')
  .regex(/^[a-z0-9_]+$/, 'Use apenas letras minúsculas, números e _');

const optionalNumber = (min: number, max: number, message: string) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine((value) => value === null || (value >= min && value <= max), message);

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .max(80, 'O nome pode ter até 80 caracteres')
    .optional()
    .transform((value) => value || null),
  username: usernameSchema,
  bio: z
    .string()
    .trim()
    .max(280, 'A bio pode ter até 280 caracteres')
    .optional()
    .transform((value) => value || null),
  birth_date: z
    .string()
    .optional()
    .transform((value) => value || null)
    .refine(
      (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'Informe a data no formato dd/mm/aaaa',
    ),
  // quem já treinava antes de baixar o app precisa poder dizer quando começou
  protocol_started_on: z
    .string()
    .optional()
    .transform((value) => value || null)
    .refine(
      (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
      'Informe a data no formato dd/mm/aaaa',
    ),
  height_cm: optionalNumber(80, 260, 'Altura fora do intervalo esperado (80 a 260 cm)'),
  goal: z.enum(GOALS.map((item) => item.value) as [string, ...string[]]).nullable().optional(),
  level: z.enum(['iniciante', 'intermediario', 'avancado']),
  default_location: z.enum(['casa', 'academia', 'externa', 'misto']),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const measurementSchema = z.object({
  measured_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  weight_kg: optionalNumber(20, 400, 'Peso fora do intervalo esperado (20 a 400 kg)'),
  waist_cm: optionalNumber(1, 300, 'Medida fora do intervalo esperado'),
  chest_cm: optionalNumber(1, 300, 'Medida fora do intervalo esperado'),
  arm_cm: optionalNumber(1, 300, 'Medida fora do intervalo esperado'),
  hip_cm: optionalNumber(1, 300, 'Medida fora do intervalo esperado'),
  thigh_cm: optionalNumber(1, 300, 'Medida fora do intervalo esperado'),
  body_fat_pct: optionalNumber(1, 70, 'Percentual fora do intervalo esperado (1 a 70%)'),
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || null),
});

export type MeasurementInput = z.infer<typeof measurementSchema>;
