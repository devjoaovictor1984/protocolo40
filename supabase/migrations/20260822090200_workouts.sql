-- =============================================================================
-- PROTOCOLO40 · 0003 — exercícios, treinos e templates
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Biblioteca de exercícios: owner_id NULL = exercício do sistema
-- -----------------------------------------------------------------------------
create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references public.profiles (id) on delete cascade,
  slug         text,
  name         text not null,
  category     public.exercise_cat not null,
  modality     public.exercise_mode not null,
  equipment    text[] not null default '{}',
  instructions text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint exercises_name_len  check (char_length(name) between 2 and 60),
  constraint exercises_slug_sys  check (owner_id is not null or slug is not null)
);

create unique index exercises_system_slug_key
  on public.exercises (slug) where owner_id is null;
create unique index exercises_owner_name_key
  on public.exercises (owner_id, lower(name)) where owner_id is not null and deleted_at is null;
create index exercises_category_idx
  on public.exercises (category) where deleted_at is null and is_active;
create index exercises_equipment_idx
  on public.exercises using gin (equipment);

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Templates: owner_id NULL = template do sistema (as sugestões de treino)
-- -----------------------------------------------------------------------------
create table public.workout_templates (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references public.profiles (id) on delete cascade,
  title             text not null,
  description       text,
  level             public.workout_level,
  place             public.workout_place,
  tags              text[] not null default '{}',
  estimated_seconds integer not null default 1200,
  is_favorite       boolean not null default false,
  use_count         integer not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,

  constraint templates_title_len  check (char_length(title) between 2 and 80),
  constraint templates_desc_len   check (description is null or char_length(description) <= 1000),
  constraint templates_seconds    check (estimated_seconds between 60 and 86400)
);

create index workout_templates_owner_idx on public.workout_templates (owner_id) where deleted_at is null;
create index workout_templates_tags_idx  on public.workout_templates using gin (tags);
create index workout_templates_level_idx on public.workout_templates (level) where owner_id is null and is_active;

create trigger workout_templates_set_updated_at
  before update on public.workout_templates
  for each row execute function public.set_updated_at();

create table public.workout_template_exercises (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id     uuid not null references public.exercises (id) on delete restrict,
  sets            smallint,
  repetitions     integer,
  duration_seconds integer,
  distance_meters integer,
  weight_kg       numeric(6, 2),
  order_index     smallint not null,
  notes           text,

  constraint wte_has_metric check (
    repetitions is not null or duration_seconds is not null or
    distance_meters is not null or weight_kg is not null
  ),
  constraint wte_positive check (
    coalesce(sets, 1) > 0 and coalesce(repetitions, 1) > 0 and
    coalesce(duration_seconds, 1) > 0 and coalesce(distance_meters, 1) > 0 and
    coalesce(weight_kg, 1) > 0
  )
);

create unique index wte_order_key on public.workout_template_exercises (template_id, order_index);
create index wte_exercise_idx on public.workout_template_exercises (exercise_id);

-- -----------------------------------------------------------------------------
-- Treinos
-- -----------------------------------------------------------------------------
create table public.workouts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  -- gerado no cliente antes de existir rede: garante idempotência da fila offline
  client_id        uuid not null,
  template_id      uuid references public.workout_templates (id) on delete set null,
  title            text,
  description      text,
  started_at       timestamptz not null,
  finished_at      timestamptz,
  -- 20 minutos é a referência do método, não um limite: qualquer duração vale
  duration_seconds integer not null,
  -- dia local do usuário; chave do streak e do calendário
  workout_date     date not null,
  rounds           smallint,
  effort           smallint,
  location         public.workout_place,
  visibility       public.visibility not null default 'private',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,

  constraint workouts_duration_range check (duration_seconds > 0 and duration_seconds <= 86400),
  constraint workouts_finish_after   check (finished_at is null or finished_at >= started_at),
  constraint workouts_rounds_range   check (rounds is null or rounds between 0 and 999),
  constraint workouts_effort_range   check (effort is null or effort between 1 and 10),
  constraint workouts_title_len      check (title is null or char_length(title) <= 80),
  constraint workouts_notes_len      check (notes is null or char_length(notes) <= 1000)
);

create unique index workouts_client_key on public.workouts (user_id, client_id);
create index workouts_user_date_idx    on public.workouts (user_id, workout_date desc) where deleted_at is null;
create index workouts_user_started_idx on public.workouts (user_id, started_at desc) where deleted_at is null;
create index workouts_feed_idx         on public.workouts (created_at desc) where visibility = 'public' and deleted_at is null;
create index workouts_template_idx     on public.workouts (template_id);

create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- workout_date derivado do fuso do dono, e não do fuso do servidor
create or replace function public.set_workout_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text;
begin
  if new.workout_date is null then
    select coalesce(p.timezone, 'America/Sao_Paulo') into tz
      from public.profiles p where p.id = new.user_id;
    new.workout_date := (new.started_at at time zone coalesce(tz, 'America/Sao_Paulo'))::date;
  end if;
  return new;
end;
$$;

create trigger workouts_set_date
  before insert on public.workouts
  for each row execute function public.set_workout_date();

-- -----------------------------------------------------------------------------
-- Exercícios de um treino
-- -----------------------------------------------------------------------------
create table public.workout_exercises (
  id               uuid primary key default gen_random_uuid(),
  workout_id       uuid not null references public.workouts (id) on delete cascade,
  exercise_id      uuid not null references public.exercises (id) on delete restrict,
  sets             smallint,
  repetitions      integer,
  duration_seconds integer,
  distance_meters  integer,
  weight_kg        numeric(6, 2),
  order_index      smallint not null,
  notes            text,

  constraint we_has_metric check (
    repetitions is not null or duration_seconds is not null or
    distance_meters is not null or weight_kg is not null
  ),
  constraint we_positive check (
    coalesce(sets, 1) > 0 and coalesce(repetitions, 1) > 0 and
    coalesce(duration_seconds, 1) > 0 and coalesce(distance_meters, 1) > 0 and
    coalesce(weight_kg, 1) > 0
  ),
  constraint we_notes_len check (notes is null or char_length(notes) <= 500)
);

create unique index we_order_key    on public.workout_exercises (workout_id, order_index);
create index we_workout_idx         on public.workout_exercises (workout_id);
-- consultas de volume e de recorde partem do exercício
create index we_exercise_idx        on public.workout_exercises (exercise_id, workout_id);
