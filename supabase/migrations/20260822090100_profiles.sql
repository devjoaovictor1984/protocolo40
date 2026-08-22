-- =============================================================================
-- PROTOCOLO40 · 0002 — perfil e configurações
-- Um profile por usuário do Auth, criado automaticamente no cadastro.
-- Nenhum campo do onboarding é obrigatório: o usuário conhece o produto antes
-- de preencher o perfil.
-- =============================================================================

create table public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  username                text not null,
  full_name               text,
  -- avatar_path é o arquivo no bucket `avatars`; avatar_url vem de provedores
  -- externos (Google). A resolução na aplicação é: path primeiro, url depois.
  avatar_path             text,
  avatar_url              text,
  bio                     text,
  birth_date              date,
  height_cm               smallint,
  goal                    public.workout_goal,
  level                   public.workout_level not null default 'iniciante',
  default_location        public.workout_place not null default 'casa',
  -- base do cálculo de streak: o dia do treino é o dia local do usuário
  timezone                text not null default 'America/Sao_Paulo',
  locale                  text not null default 'pt-BR',
  protocol_started_on     date not null default current_date,
  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,

  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_full_name_len   check (full_name is null or char_length(full_name) <= 80),
  constraint profiles_bio_len         check (bio is null or char_length(bio) <= 280),
  constraint profiles_height_range    check (height_cm is null or height_cm between 80 and 260),
  constraint profiles_birth_past      check (birth_date is null or birth_date < current_date)
);

create unique index profiles_username_key on public.profiles (username);
create index profiles_deleted_idx on public.profiles (id) where deleted_at is null;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

comment on column public.profiles.timezone is
  'Fuso do usuário. Define o dia local usado por workouts.workout_date e pelo streak.';

-- -----------------------------------------------------------------------------
-- Configurações e privacidade — padrões seguros: tudo privado
-- -----------------------------------------------------------------------------
create table public.user_settings (
  user_id                 uuid primary key references public.profiles (id) on delete cascade,
  theme                   public.theme_pref not null default 'system',
  daily_goal_seconds      integer not null default 1200,

  profile_visibility      public.visibility not null default 'private',
  workouts_visibility     public.visibility not null default 'private',
  photos_visibility       public.visibility not null default 'private',
  weight_visibility       public.visibility not null default 'private',
  measurements_visibility public.visibility not null default 'private',
  streak_visibility       public.visibility not null default 'private',

  allow_followers         boolean not null default true,
  reminder_time           time,
  notification_prefs      jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint user_settings_goal_range check (daily_goal_seconds between 60 and 86400)
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Provisionamento automático no cadastro
-- Roda como SECURITY DEFINER porque insere em nome de um usuário que ainda não
-- tem sessão no momento do INSERT em auth.users.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
  candidate text;
  suffix    integer := 0;
begin
  -- username derivado do e-mail, saneado para o formato aceito
  base_name := regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g');
  if char_length(base_name) < 3 then
    base_name := 'atleta';
  end if;
  base_name := left(base_name, 16);
  candidate := base_name;

  while exists (select 1 from public.profiles where username = candidate) loop
    suffix    := suffix + 1;
    candidate := base_name || suffix::text;
  end loop;

  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    candidate,
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), '')
  );

  insert into public.user_settings (user_id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
