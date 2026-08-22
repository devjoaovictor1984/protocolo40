-- =============================================================================
-- PROTOCOLO40 · 0004 — medidas, fotos, recordes e estatísticas
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Medidas corporais: só a data é obrigatória
-- -----------------------------------------------------------------------------
create table public.body_measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  client_id    uuid not null,
  measured_on  date not null,
  weight_kg    numeric(5, 2),
  waist_cm     numeric(5, 2),
  chest_cm     numeric(5, 2),
  arm_cm       numeric(5, 2),
  hip_cm       numeric(5, 2),
  thigh_cm     numeric(5, 2),
  body_fat_pct numeric(4, 1),
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,

  constraint bm_weight_range  check (weight_kg is null or weight_kg between 20 and 400),
  constraint bm_fat_range     check (body_fat_pct is null or body_fat_pct between 1 and 70),
  constraint bm_cm_range      check (
    coalesce(waist_cm, 1) between 1 and 300 and coalesce(chest_cm, 1) between 1 and 300 and
    coalesce(arm_cm, 1)   between 1 and 300 and coalesce(hip_cm, 1)   between 1 and 300 and
    coalesce(thigh_cm, 1) between 1 and 300
  ),
  constraint bm_notes_len     check (notes is null or char_length(notes) <= 500),
  constraint bm_not_future    check (measured_on <= (current_date + 1))
);

create unique index bm_client_key   on public.body_measurements (user_id, client_id);
create unique index bm_day_key      on public.body_measurements (user_id, measured_on) where deleted_at is null;
create index bm_user_date_idx       on public.body_measurements (user_id, measured_on desc) where deleted_at is null;

create trigger body_measurements_set_updated_at
  before update on public.body_measurements
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Fotos de evolução — nascem privadas (ver a policy de INSERT em 0006)
-- -----------------------------------------------------------------------------
create table public.progress_photos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  client_id      uuid not null,
  workout_id     uuid references public.workouts (id) on delete set null,
  storage_path   text not null,
  thumbnail_path text not null,
  pose           public.photo_pose not null default 'frente',
  taken_at       timestamptz not null default now(),
  taken_on       date not null,
  weight_kg      numeric(5, 2),
  width          integer,
  height         integer,
  byte_size      integer,
  visibility     public.visibility not null default 'private',
  notes          text,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz,

  constraint photos_weight_range check (weight_kg is null or weight_kg between 20 and 400),
  constraint photos_notes_len    check (notes is null or char_length(notes) <= 500),
  constraint photos_size_limit   check (byte_size is null or byte_size <= 2 * 1024 * 1024)
);

create unique index photos_client_key on public.progress_photos (user_id, client_id);
create index photos_user_taken_idx    on public.progress_photos (user_id, taken_at desc) where deleted_at is null;
create index photos_workout_idx       on public.progress_photos (workout_id);

-- -----------------------------------------------------------------------------
-- Recordes pessoais — histórico completo; o recorde atual é o maior valor
-- -----------------------------------------------------------------------------
create table public.personal_records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  exercise_id    uuid references public.exercises (id) on delete cascade,
  metric         public.record_metric not null,
  value          numeric(10, 2) not null,
  unit           text,
  workout_id     uuid references public.workouts (id) on delete cascade,
  achieved_on    date not null,
  previous_value numeric(10, 2),
  created_at     timestamptz not null default now(),

  constraint pr_value_positive check (value > 0)
);

create index pr_lookup_idx    on public.personal_records (user_id, exercise_id, metric, value desc);
create index pr_user_date_idx on public.personal_records (user_id, achieved_on desc);

-- Grava um recorde se o valor superar o melhor anterior.
-- SECURITY DEFINER: a policy de personal_records não permite INSERT direto pelo
-- cliente, para que ninguém forje um recorde chamando a API.
create or replace function public.register_record(
  p_user     uuid,
  p_exercise uuid,
  p_metric   public.record_metric,
  p_value    numeric,
  p_unit     text,
  p_workout  uuid,
  p_on       date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  best numeric;
begin
  if p_value is null or p_value <= 0 then
    return false;
  end if;

  select max(value) into best
    from public.personal_records
   where user_id = p_user
     and metric = p_metric
     and exercise_id is not distinct from p_exercise;

  if best is not null and p_value <= best then
    return false;
  end if;

  insert into public.personal_records
    (user_id, exercise_id, metric, value, unit, workout_id, achieved_on, previous_value)
  values
    (p_user, p_exercise, p_metric, p_value, p_unit, p_workout, p_on, best);

  return true;
end;
$$;

-- Recordes do treino em si: rounds e duração
create or replace function public.detect_workout_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  perform public.register_record(
    new.user_id, null, 'duration', new.duration_seconds, 'segundos', new.id, new.workout_date
  );

  if new.rounds is not null and new.rounds > 0 then
    perform public.register_record(
      new.user_id, null, 'rounds', new.rounds, 'rounds', new.id, new.workout_date
    );
  end if;

  return new;
end;
$$;

create trigger workouts_detect_records
  after insert on public.workouts
  for each row execute function public.detect_workout_records();

-- Recordes por exercício: repetições totais, carga, distância e duração
create or replace function public.detect_exercise_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  w        record;
  tot_reps numeric;
begin
  select user_id, workout_date, deleted_at into w
    from public.workouts where id = new.workout_id;

  if w is null or w.deleted_at is not null then
    return new;
  end if;

  tot_reps := coalesce(new.sets, 1) * new.repetitions;

  perform public.register_record(w.user_id, new.exercise_id, 'reps',     tot_reps,             'repetições', new.workout_id, w.workout_date);
  perform public.register_record(w.user_id, new.exercise_id, 'weight',   new.weight_kg,        'kg',         new.workout_id, w.workout_date);
  perform public.register_record(w.user_id, new.exercise_id, 'distance', new.distance_meters,  'metros',     new.workout_id, w.workout_date);
  perform public.register_record(w.user_id, new.exercise_id, 'duration', new.duration_seconds, 'segundos',   new.workout_id, w.workout_date);

  return new;
end;
$$;

create trigger workout_exercises_detect_records
  after insert on public.workout_exercises
  for each row execute function public.detect_exercise_records();

-- -----------------------------------------------------------------------------
-- Estatísticas: sequência atual, maior sequência, dias e minutos acumulados
-- SECURITY INVOKER de propósito — a RLS de workouts continua valendo.
-- -----------------------------------------------------------------------------
create or replace function public.get_user_stats(p_user uuid)
returns table (
  current_streak int,
  longest_streak int,
  total_days     int,
  total_seconds  bigint,
  last_workout   date
)
language sql
stable
as $$
  with tz as (
    select coalesce(timezone, 'America/Sao_Paulo') as t
      from public.profiles where id = p_user
  ),
  today as (
    select (now() at time zone (select coalesce((select t from tz), 'America/Sao_Paulo')))::date as d
  ),
  days as (
    select distinct workout_date as day
      from public.workouts
     where user_id = p_user and deleted_at is null
  ),
  grouped as (
    select day, day - (row_number() over (order by day))::int as grp from days
  ),
  runs as (
    select min(day) as ini, max(day) as fim, count(*)::int as len
      from grouped group by grp
  )
  select
    -- a sequência continua viva durante o dia corrente, mesmo sem treino ainda
    coalesce((select len from runs
               where fim >= (select d from today) - 1
               order by fim desc limit 1), 0),
    coalesce((select max(len) from runs), 0),
    (select count(*)::int from days),
    (select coalesce(sum(duration_seconds), 0)::bigint from public.workouts
      where user_id = p_user and deleted_at is null),
    (select max(day) from days);
$$;

comment on function public.get_user_stats is
  'Sequência e totais do usuário. Gaps and islands sobre os dias distintos de treino.';
