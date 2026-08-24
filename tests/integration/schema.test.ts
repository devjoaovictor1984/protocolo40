import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Deriva do schema.
 *
 * `types/database.ts` é mantido à mão enquanto a geração automática depende de
 * Docker ou de um access token. Este teste tira o risco disso: pergunta ao
 * PostgREST quais colunas existem de verdade e compara com o que o TypeScript
 * declara. Uma migration que mude uma coluna sem atualizar o tipo quebra aqui.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && secret) && !url!.includes('placeholder');

/** Colunas herdadas de tipos compartilhados, que o regex não enxerga no bloco. */
const INHERITED: Record<string, string[]> = {
  ProfileRow: ['created_at', 'updated_at'],
  UserSettingsRow: ['created_at', 'updated_at'],
  ExerciseRow: ['created_at', 'updated_at'],
  WorkoutTemplateRow: ['created_at', 'updated_at'],
  WorkoutRow: ['created_at', 'updated_at'],
  BodyMeasurementRow: ['created_at', 'updated_at'],
  WorkoutCommentRow: ['created_at', 'updated_at'],
  SupportTicketRow: ['created_at', 'updated_at'],
  WaterLogRow: ['created_at', 'updated_at'],
  PlanRow: ['created_at', 'updated_at'],
  SubscriptionRow: ['created_at', 'updated_at'],
  WorkoutTemplateExerciseRow: [
    'sets',
    'repetitions',
    'duration_seconds',
    'distance_meters',
    'weight_kg',
    'order_index',
    'notes',
  ],
  WorkoutExerciseRow: [
    'sets',
    'repetitions',
    'duration_seconds',
    'distance_meters',
    'weight_kg',
    'order_index',
    'notes',
  ],
};

const TABLE_TO_TYPE: Record<string, string> = {
  profiles: 'ProfileRow',
  user_settings: 'UserSettingsRow',
  exercises: 'ExerciseRow',
  workout_templates: 'WorkoutTemplateRow',
  workout_template_exercises: 'WorkoutTemplateExerciseRow',
  workouts: 'WorkoutRow',
  workout_exercises: 'WorkoutExerciseRow',
  body_measurements: 'BodyMeasurementRow',
  progress_photos: 'ProgressPhotoRow',
  personal_records: 'PersonalRecordRow',
  followers: 'FollowerRow',
  workout_likes: 'WorkoutLikeRow',
  workout_comments: 'WorkoutCommentRow',
  notifications: 'NotificationRow',
  video_exports: 'VideoExportRow',
  analytics_events: 'AnalyticsEventRow',
  support_tickets: 'SupportTicketRow',
  badges: 'BadgeRow',
  user_badges: 'UserBadgeRow',
  water_logs: 'WaterLogRow',
  daily_messages: 'DailyMessageRow',
  plans: 'PlanRow',
  rest_days: 'RestDayRow',
  subscriptions: 'SubscriptionRow',
  admin_audit_log: 'AdminAuditRow',
};

type OpenApiSpec = {
  definitions?: Record<string, { properties: Record<string, unknown> }>;
};

function declaredColumns(source: string): Record<string, string[]> {
  const blocks: Record<string, string[]> = {};
  const typePattern = /export type (\w+Row) = (?:\w+ & )?\{([\s\S]*?)\n\};/g;

  let match: RegExpExecArray | null;
  while ((match = typePattern.exec(source)) !== null) {
    const [, name, body] = match;
    const fields = [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((field) => field[1]);
    blocks[name] = [...fields, ...(INHERITED[name] ?? [])].sort();
  }

  return blocks;
}

describe.skipIf(!configured)('schema', () => {
  it('types/database.ts descreve as mesmas colunas que o banco tem', async () => {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: secret!,
        Authorization: `Bearer ${secret!}`,
        Accept: 'application/openapi+json',
      },
    });

    expect(response.ok).toBe(true);

    const spec = (await response.json()) as OpenApiSpec;
    const definitions = spec.definitions ?? {};
    const declared = declaredColumns(readFileSync('types/database.ts', 'utf8'));

    const divergences: string[] = [];

    for (const [table, typeName] of Object.entries(TABLE_TO_TYPE)) {
      const definition = definitions[table];

      if (!definition) {
        divergences.push(`${table}: existe no TypeScript mas não no banco`);
        continue;
      }

      const inDatabase = Object.keys(definition.properties).sort();
      const inTypescript = declared[typeName] ?? [];

      const missing = inDatabase.filter((column) => !inTypescript.includes(column));
      const extra = inTypescript.filter((column) => !inDatabase.includes(column));

      if (missing.length > 0) {
        divergences.push(`${table}: faltam no tipo — ${missing.join(', ')}`);
      }
      if (extra.length > 0) {
        divergences.push(`${table}: sobram no tipo — ${extra.join(', ')}`);
      }
    }

    expect(divergences).toEqual([]);
  });

  it('todas as tabelas do schema estão mapeadas', async () => {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: secret!,
        Authorization: `Bearer ${secret!}`,
        Accept: 'application/openapi+json',
      },
    });

    const spec = (await response.json()) as OpenApiSpec;
    const tables = Object.keys(spec.definitions ?? {});
    const mapped = Object.keys(TABLE_TO_TYPE);

    // uma tabela nova sem tipo correspondente também é deriva
    expect(tables.filter((table) => !mapped.includes(table))).toEqual([]);
    expect(tables).toHaveLength(mapped.length);
  });
});
