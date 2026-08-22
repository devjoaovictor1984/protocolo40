-- =============================================================================
-- PROTOCOLO40 · 0005 — comunidade, notificações, exports e eventos
-- Estruturado agora, implementado na interface só nas fases 3 e 4.
-- =============================================================================

create table public.followers (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  status       public.follow_status not null default 'accepted',
  created_at   timestamptz not null default now(),

  primary key (follower_id, following_id),
  constraint followers_not_self check (follower_id <> following_id)
);

create index followers_following_idx on public.followers (following_id, status);

create table public.workout_likes (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (workout_id, user_id)
);

create index workout_likes_user_idx on public.workout_likes (user_id);

create table public.workout_comments (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint comments_body_len check (char_length(btrim(body)) between 1 and 500)
);

create index workout_comments_workout_idx
  on public.workout_comments (workout_id, created_at) where deleted_at is null;

create trigger workout_comments_set_updated_at
  before update on public.workout_comments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Notificações — base para Web Push no futuro. Nada agressivo.
-- -----------------------------------------------------------------------------
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  actor_id    uuid references public.profiles (id) on delete set null,
  entity_type text,
  entity_id   uuid,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

-- -----------------------------------------------------------------------------
-- Fila de exportação de vídeo. O worker externo consome daqui; nenhum FFmpeg
-- roda em request da aplicação.
-- -----------------------------------------------------------------------------
create table public.video_exports (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  status            public.export_status not null default 'queued',
  start_date        date,
  end_date          date,
  photo_ids         uuid[] not null default '{}',
  format            text not null default '9:16',
  frame_duration_ms integer not null default 500,
  options           jsonb not null default '{}'::jsonb,
  output_path       text,
  thumbnail_path    text,
  progress          smallint not null default 0,
  attempts          smallint not null default 0,
  error             text,
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz,

  constraint exports_format check (format in ('9:16', '1:1', '16:9')),
  constraint exports_frame  check (frame_duration_ms in (200, 500, 1000, 2000)),
  constraint exports_progress check (progress between 0 and 100)
);

create index video_exports_queue_idx on public.video_exports (created_at) where status = 'queued';
create index video_exports_user_idx  on public.video_exports (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Eventos de produto. Nunca recebe peso, medida, foto ou texto livre.
-- -----------------------------------------------------------------------------
create table public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  name        text not null,
  props       jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),

  constraint analytics_name_len check (char_length(name) between 2 and 60)
);

create index analytics_events_name_idx on public.analytics_events (name, occurred_at desc);
