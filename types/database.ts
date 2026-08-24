/**
 * Tipos do banco.
 *
 * Mantidos à mão até o primeiro `npm run db:types`, que regenera este arquivo a
 * partir do schema real com o Supabase CLI. A forma segue exatamente a das
 * migrations em `supabase/migrations`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Visibility = 'private' | 'followers' | 'public';
export type WorkoutLevel = 'iniciante' | 'intermediario' | 'avancado';
/** Como o treino é executado. AMRAP repete o circuito até o tempo acabar. */
export type WorkoutMethod = 'amrap' | 'livre';
export type WorkoutPlace = 'casa' | 'academia' | 'externa' | 'misto';
export type WorkoutGoal =
  | 'perder_gordura'
  | 'ganhar_forca'
  | 'condicionamento'
  | 'ganhar_massa'
  | 'melhorar_shape'
  | 'criar_disciplina'
  | 'manter_saude'
  | 'outro';
export type ExerciseCategory =
  | 'peito'
  | 'costas'
  | 'ombros'
  | 'bracos'
  | 'pernas'
  | 'abdomen'
  | 'cardio'
  | 'mobilidade'
  | 'corpo_inteiro';
export type ExerciseModality = 'reps' | 'time' | 'distance' | 'load';
export type RecordMetric = 'reps' | 'duration' | 'distance' | 'weight' | 'rounds' | 'volume';
export type ExportStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'canceled';
export type FollowStatus = 'pending' | 'accepted';
export type PhotoPose = 'frente' | 'lado' | 'costas' | 'outro';
export type ThemePref = 'light' | 'dark' | 'system';
export type TicketKind = 'sugestao' | 'erro' | 'duvida' | 'outro';
export type TicketStatus = 'aberto' | 'em_analise' | 'resolvido' | 'fechado';
export type BadgeMetric = 'dias' | 'barras' | 'flexoes' | 'fundador';
export type BadgeTier = 'bronze' | 'ferro' | 'prata' | 'ouro' | 'imperial';
export type BiologicalSex = 'feminino' | 'masculino' | 'nao_informado';
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid';
export type BillingInterval = 'mes' | 'ano' | 'vitalicio';
/** Recursos que um plano pode liberar. O núcleo do produto nunca entra aqui. */
export type Recurso = 'analise' | 'saude' | 'video';

type Timestamps = { created_at: string; updated_at: string };

export type ProfileRow = Timestamps & {
  id: string;
  username: string;
  full_name: string | null;
  avatar_path: string | null;
  avatar_url: string | null;
  bio: string | null;
  birth_date: string | null;
  height_cm: number | null;
  goal: WorkoutGoal | null;
  level: WorkoutLevel;
  default_location: WorkoutPlace;
  timezone: string;
  locale: string;
  protocol_started_on: string;
  onboarding_completed_at: string | null;
  is_admin: boolean;
  biological_sex: BiologicalSex;
  showcase_before_id: string | null;
  showcase_after_id: string | null;
  deleted_at: string | null;
};

export type UserSettingsRow = Timestamps & {
  user_id: string;
  theme: ThemePref;
  daily_goal_seconds: number;
  profile_visibility: Visibility;
  workouts_visibility: Visibility;
  photos_visibility: Visibility;
  weight_visibility: Visibility;
  measurements_visibility: Visibility;
  streak_visibility: Visibility;
  allow_followers: boolean;
  reminder_time: string | null;
  notification_prefs: Json;
};

export type ExerciseRow = Timestamps & {
  id: string;
  owner_id: string | null;
  slug: string | null;
  name: string;
  category: ExerciseCategory;
  modality: ExerciseModality;
  equipment: string[];
  instructions: string | null;
  is_active: boolean;
  deleted_at: string | null;
};

export type WorkoutTemplateRow = Timestamps & {
  id: string;
  owner_id: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  method: WorkoutMethod;
  level: WorkoutLevel | null;
  place: WorkoutPlace | null;
  tags: string[];
  estimated_seconds: number;
  sort_order: number;
  is_favorite: boolean;
  use_count: number;
  is_active: boolean;
  deleted_at: string | null;
};

/** Métricas de um exercício, dentro de um treino ou de um template. */
export type ExerciseMetrics = {
  sets: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  weight_kg: number | null;
  order_index: number;
  notes: string | null;
};

export type WorkoutTemplateExerciseRow = ExerciseMetrics & {
  id: string;
  template_id: string;
  exercise_id: string;
};

export type WorkoutRow = Timestamps & {
  id: string;
  user_id: string;
  client_id: string;
  template_id: string | null;
  title: string | null;
  description: string | null;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number;
  workout_date: string;
  rounds: number | null;
  effort: number | null;
  location: WorkoutPlace | null;
  visibility: Visibility;
  notes: string | null;
  deleted_at: string | null;
};

export type WorkoutExerciseRow = ExerciseMetrics & {
  id: string;
  workout_id: string;
  exercise_id: string;
};

export type BodyMeasurementRow = Timestamps & {
  id: string;
  user_id: string;
  client_id: string;
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  hip_cm: number | null;
  thigh_cm: number | null;
  body_fat_pct: number | null;
  notes: string | null;
  deleted_at: string | null;
};

export type ProgressPhotoRow = {
  id: string;
  user_id: string;
  client_id: string;
  workout_id: string | null;
  storage_path: string;
  thumbnail_path: string;
  pose: PhotoPose;
  taken_at: string;
  taken_on: string;
  weight_kg: number | null;
  width: number | null;
  height: number | null;
  byte_size: number | null;
  visibility: Visibility;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type PersonalRecordRow = {
  id: string;
  user_id: string;
  exercise_id: string | null;
  metric: RecordMetric;
  value: number;
  unit: string | null;
  workout_id: string | null;
  achieved_on: string;
  previous_value: number | null;
  created_at: string;
};

export type FollowerRow = {
  follower_id: string;
  following_id: string;
  status: FollowStatus;
  created_at: string;
};

export type WorkoutLikeRow = {
  workout_id: string;
  user_id: string;
  created_at: string;
};

export type WorkoutCommentRow = Timestamps & {
  id: string;
  workout_id: string;
  user_id: string;
  body: string;
  deleted_at: string | null;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Json;
  read_at: string | null;
  created_at: string;
};

export type VideoExportRow = {
  id: string;
  user_id: string;
  status: ExportStatus;
  start_date: string | null;
  end_date: string | null;
  photo_ids: string[];
  format: '9:16' | '1:1' | '16:9';
  frame_duration_ms: number;
  options: Json;
  output_path: string | null;
  thumbnail_path: string | null;
  progress: number;
  attempts: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type AnalyticsEventRow = {
  id: string;
  user_id: string | null;
  name: string;
  props: Json;
  occurred_at: string;
};

export type UserStats = {
  current_streak: number;
  longest_streak: number;
  total_days: number;
  total_seconds: number;
  last_workout: string | null;
};

export type SupportTicketRow = Timestamps & {
  id: string;
  user_id: string;
  kind: TicketKind;
  title: string;
  body: string;
  screenshot_path: string | null;
  status: TicketStatus;
  answer: string | null;
  answered_at: string | null;
  answered_by: string | null;
  page_url: string | null;
  user_agent: string | null;
  app_version: string | null;
};

export type WaterLogRow = Timestamps & {
  user_id: string;
  day: string;
  ml: number;
};

export type RestDayRow = {
  user_id: string;
  day: string;
  note: string | null;
  created_at: string;
};

export type PlanRow = Timestamps & {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  interval: BillingInterval;
  stripe_price_id: string | null;
  features: string[];
  is_active: boolean;
  sort_order: number;
};

export type SubscriptionRow = Timestamps & {
  user_id: string;
  plan_slug: string;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  granted_by: string | null;
  granted_reason: string | null;
};

export type AdminAuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_id: string | null;
  detail: Json;
  created_at: string;
};

export type DailyMessageRow = {
  day_of_year: number;
  reference: string;
  verse: string;
  theme: string;
  message: string;
};

export type BadgeRow = {
  slug: string;
  name: string;
  description: string;
  metric: BadgeMetric;
  threshold: number;
  tier: BadgeTier;
  emblem: string;
  sort_order: number;
};

export type UserBadgeRow = {
  user_id: string;
  badge_slug: string;
  earned_on: string;
  value: number | null;
  created_at: string;
};

/**
 * Forma que o supabase-js espera de cada tabela.
 *
 * `Relationships` não é decoração: é o que permite ao postgrest-js tipar um
 * select aninhado como `workouts(..., workout_exercises(...))`. Sem a relação
 * declarada, o retorno do embed vira `never` e o TypeScript não ajuda mais.
 */
type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableDef<
  Row,
  Insert = Partial<Row>,
  Update = Partial<Row>,
  Rel extends Relationship[] = [],
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Rel;
};

/** Atalho para as chaves estrangeiras, que sempre apontam para o `id`. */
type FK<Name extends string, Column extends string, Target extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Target;
  referencedColumns: ['id'];
};

/** Insert com as colunas obrigatórias explícitas; o resto é opcional. */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Row>;

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, InsertOf<ProfileRow, 'id' | 'username'>>;
      user_settings: TableDef<
        UserSettingsRow,
        InsertOf<UserSettingsRow, 'user_id'>,
        Partial<UserSettingsRow>,
        [FK<'user_settings_user_id_fkey', 'user_id', 'profiles'>]
      >;
      exercises: TableDef<ExerciseRow, InsertOf<ExerciseRow, 'name' | 'category' | 'modality'>>;
      workout_templates: TableDef<WorkoutTemplateRow, InsertOf<WorkoutTemplateRow, 'title'>>;
      workout_template_exercises: TableDef<
        WorkoutTemplateExerciseRow,
        InsertOf<WorkoutTemplateExerciseRow, 'template_id' | 'exercise_id' | 'order_index'>,
        Partial<WorkoutTemplateExerciseRow>,
        [
          FK<'wte_template_id_fkey', 'template_id', 'workout_templates'>,
          FK<'wte_exercise_id_fkey', 'exercise_id', 'exercises'>,
        ]
      >;
      workouts: TableDef<
        WorkoutRow,
        InsertOf<WorkoutRow, 'user_id' | 'client_id' | 'started_at' | 'duration_seconds'>,
        Partial<WorkoutRow>,
        [
          FK<'workouts_user_id_fkey', 'user_id', 'profiles'>,
          FK<'workouts_template_id_fkey', 'template_id', 'workout_templates'>,
        ]
      >;
      workout_exercises: TableDef<
        WorkoutExerciseRow,
        InsertOf<WorkoutExerciseRow, 'workout_id' | 'exercise_id' | 'order_index'>,
        Partial<WorkoutExerciseRow>,
        [
          FK<'workout_exercises_workout_id_fkey', 'workout_id', 'workouts'>,
          FK<'workout_exercises_exercise_id_fkey', 'exercise_id', 'exercises'>,
        ]
      >;
      body_measurements: TableDef<
        BodyMeasurementRow,
        InsertOf<BodyMeasurementRow, 'user_id' | 'client_id' | 'measured_on'>
      >;
      progress_photos: TableDef<
        ProgressPhotoRow,
        InsertOf<ProgressPhotoRow, 'user_id' | 'client_id' | 'storage_path' | 'thumbnail_path' | 'taken_on'>,
        Partial<ProgressPhotoRow>,
        [
          FK<'progress_photos_user_id_fkey', 'user_id', 'profiles'>,
          FK<'progress_photos_workout_id_fkey', 'workout_id', 'workouts'>,
        ]
      >;
      // O INSERT existe no tipo, mas a RLS não tem policy de INSERT para o
      // cliente: quem grava recorde é o trigger. O tipo descreve a tabela; a
      // autorização continua sendo do banco.
      personal_records: TableDef<
        PersonalRecordRow,
        InsertOf<PersonalRecordRow, 'user_id' | 'metric' | 'value' | 'achieved_on'>,
        Partial<PersonalRecordRow>,
        [
          FK<'personal_records_exercise_id_fkey', 'exercise_id', 'exercises'>,
          FK<'personal_records_workout_id_fkey', 'workout_id', 'workouts'>,
        ]
      >;
      followers: TableDef<FollowerRow, InsertOf<FollowerRow, 'follower_id' | 'following_id'>>;
      workout_likes: TableDef<WorkoutLikeRow, InsertOf<WorkoutLikeRow, 'workout_id' | 'user_id'>>;
      workout_comments: TableDef<
        WorkoutCommentRow,
        InsertOf<WorkoutCommentRow, 'workout_id' | 'user_id' | 'body'>
      >;
      notifications: TableDef<NotificationRow, InsertOf<NotificationRow, 'user_id' | 'type'>>;
      video_exports: TableDef<VideoExportRow, InsertOf<VideoExportRow, 'user_id'>>;
      analytics_events: TableDef<AnalyticsEventRow, InsertOf<AnalyticsEventRow, 'name'>>;
      support_tickets: TableDef<
        SupportTicketRow,
        InsertOf<SupportTicketRow, 'user_id' | 'title' | 'body'>,
        Partial<SupportTicketRow>,
        [
          FK<'support_tickets_user_id_fkey', 'user_id', 'profiles'>,
          FK<'support_tickets_answered_by_fkey', 'answered_by', 'profiles'>,
        ]
      >;
      badges: TableDef<BadgeRow, InsertOf<BadgeRow, 'slug' | 'name'>>;
      daily_messages: TableDef<DailyMessageRow, InsertOf<DailyMessageRow, 'day_of_year'>>;
      plans: TableDef<PlanRow, InsertOf<PlanRow, 'slug' | 'name'>>;
      // Sem policy de INSERT: quem grava é `registrar_descanso`, que confere o
      // limite de um por semana.
      rest_days: TableDef<
        RestDayRow,
        InsertOf<RestDayRow, 'user_id' | 'day'>,
        Partial<RestDayRow>,
        [FK<'rest_days_user_id_fkey', 'user_id', 'profiles'>]
      >;
      // Sem policy de escrita para o cliente: quem grava é o webhook ou uma
      // função auditada. O tipo descreve a tabela; a autorização é do banco.
      subscriptions: TableDef<
        SubscriptionRow,
        InsertOf<SubscriptionRow, 'user_id' | 'plan_slug'>,
        Partial<SubscriptionRow>,
        [
          FK<'subscriptions_user_id_fkey', 'user_id', 'profiles'>,
          {
            foreignKeyName: 'subscriptions_plan_slug_fkey';
            columns: ['plan_slug'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['slug'];
          },
        ]
      >;
      admin_audit_log: TableDef<AdminAuditRow, InsertOf<AdminAuditRow, 'action'>>;
      water_logs: TableDef<
        WaterLogRow,
        InsertOf<WaterLogRow, 'user_id' | 'day'>,
        Partial<WaterLogRow>,
        [FK<'water_logs_user_id_fkey', 'user_id', 'profiles'>]
      >;
      // Sem policy de INSERT: quem concede é `conceder_conquistas`, no banco.
      user_badges: TableDef<
        UserBadgeRow,
        InsertOf<UserBadgeRow, 'user_id' | 'badge_slug'>,
        Partial<UserBadgeRow>,
        [
          FK<'user_badges_user_id_fkey', 'user_id', 'profiles'>,
          {
            foreignKeyName: 'user_badges_badge_slug_fkey';
            columns: ['badge_slug'];
            isOneToOne: false;
            referencedRelation: 'badges';
            referencedColumns: ['slug'];
          },
        ]
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      get_user_stats: {
        Args: { p_user: string };
        Returns: UserStats[];
      };
      eh_admin: {
        Args: { p_user?: string };
        Returns: boolean;
      };
      somar_agua: {
        Args: { p_day: string; p_ml: number };
        Returns: number;
      };
      contar_seguidores: {
        Args: { p_user: string };
        Returns: number;
      };
      contar_seguindo: {
        Args: { p_user: string };
        Returns: number;
      };
      buscar_pessoas: {
        Args: { p_termo: string; p_limite?: number };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_path: string | null;
          avatar_url: string | null;
          seguidores: number;
        }[];
      };
      minha_rede: {
        Args: { p_tipo: string };
        Returns: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_path: string | null;
          avatar_url: string | null;
          dias_treinados: number | null;
          sequencia: number | null;
          desde: string;
        }[];
      };
      registrar_descanso: {
        Args: { p_day: string; p_note?: string | null };
        Returns: string;
      };
      tem_acesso: {
        Args: { p_recurso: string; p_user?: string };
        Returns: boolean;
      };
      conceder_plano: {
        Args: { p_user: string; p_plan: string; p_ate: string | null; p_motivo: string | null };
        Returns: undefined;
      };
      revogar_plano: {
        Args: { p_user: string; p_motivo: string | null };
        Returns: undefined;
      };
    };
    Enums: {
      visibility: Visibility;
      workout_level: WorkoutLevel;
      workout_method: WorkoutMethod;
      workout_place: WorkoutPlace;
      workout_goal: WorkoutGoal;
      exercise_cat: ExerciseCategory;
      exercise_mode: ExerciseModality;
      record_metric: RecordMetric;
      export_status: ExportStatus;
      follow_status: FollowStatus;
      photo_pose: PhotoPose;
      theme_pref: ThemePref;
      ticket_kind: TicketKind;
      ticket_status: TicketStatus;
      badge_metric: BadgeMetric;
      badge_tier: BadgeTier;
      biological_sex: BiologicalSex;
      subscription_status: SubscriptionStatus;
      billing_interval: BillingInterval;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
