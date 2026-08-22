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
  description: string | null;
  level: WorkoutLevel | null;
  place: WorkoutPlace | null;
  tags: string[];
  estimated_seconds: number;
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

/**
 * Forma que o supabase-js espera de cada tabela. `Relationships` fica vazio: os
 * joins deste projeto são explícitos, e não dependem da inferência de relação.
 */
type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

/** Insert com as colunas obrigatórias explícitas; o resto é opcional. */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Row>;

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, InsertOf<ProfileRow, 'id' | 'username'>>;
      user_settings: TableDef<UserSettingsRow, InsertOf<UserSettingsRow, 'user_id'>>;
      exercises: TableDef<ExerciseRow, InsertOf<ExerciseRow, 'name' | 'category' | 'modality'>>;
      workout_templates: TableDef<WorkoutTemplateRow, InsertOf<WorkoutTemplateRow, 'title'>>;
      workout_template_exercises: TableDef<
        WorkoutTemplateExerciseRow,
        InsertOf<WorkoutTemplateExerciseRow, 'template_id' | 'exercise_id' | 'order_index'>
      >;
      workouts: TableDef<
        WorkoutRow,
        InsertOf<WorkoutRow, 'user_id' | 'client_id' | 'started_at' | 'duration_seconds'>
      >;
      workout_exercises: TableDef<
        WorkoutExerciseRow,
        InsertOf<WorkoutExerciseRow, 'workout_id' | 'exercise_id' | 'order_index'>
      >;
      body_measurements: TableDef<
        BodyMeasurementRow,
        InsertOf<BodyMeasurementRow, 'user_id' | 'client_id' | 'measured_on'>
      >;
      progress_photos: TableDef<
        ProgressPhotoRow,
        InsertOf<ProgressPhotoRow, 'user_id' | 'client_id' | 'storage_path' | 'thumbnail_path' | 'taken_on'>
      >;
      // O INSERT existe no tipo, mas a RLS não tem policy de INSERT para o
      // cliente: quem grava recorde é o trigger. O tipo descreve a tabela; a
      // autorização continua sendo do banco.
      personal_records: TableDef<
        PersonalRecordRow,
        InsertOf<PersonalRecordRow, 'user_id' | 'metric' | 'value' | 'achieved_on'>
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
    };
    Views: { [_ in never]: never };
    Functions: {
      get_user_stats: {
        Args: { p_user: string };
        Returns: UserStats[];
      };
    };
    Enums: {
      visibility: Visibility;
      workout_level: WorkoutLevel;
      workout_place: WorkoutPlace;
      workout_goal: WorkoutGoal;
      exercise_cat: ExerciseCategory;
      exercise_mode: ExerciseModality;
      record_metric: RecordMetric;
      export_status: ExportStatus;
      follow_status: FollowStatus;
      photo_pose: PhotoPose;
      theme_pref: ThemePref;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
