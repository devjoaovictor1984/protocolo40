-- =============================================================================
-- PROTOCOLO40 · 0006 — Row Level Security
-- A autorização vive aqui. O frontend nunca é a última palavra.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- SECURITY DEFINER evita recursão de política: sem isso, a policy de workouts
-- consultaria followers, cuja policy consultaria profiles, e assim por diante.
-- -----------------------------------------------------------------------------
create or replace function public.is_follower(p_owner uuid, p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.followers
     where following_id = p_owner
       and follower_id = p_viewer
       and status = 'accepted'
  );
$$;

create or replace function public.can_view(p_owner uuid, p_visibility public.visibility)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_owner is null            then false
    when p_owner = auth.uid()       then true
    when p_visibility = 'public'    then true
    when p_visibility = 'followers' then public.is_follower(p_owner, auth.uid())
    else false
  end;
$$;

-- Visibilidade que mora em user_settings (perfil, peso, medidas, sequência)
create or replace function public.can_view_setting(p_owner uuid, p_setting text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.visibility;
begin
  if p_owner is null then
    return false;
  end if;
  if p_owner = auth.uid() then
    return true;
  end if;

  select case p_setting
           when 'profile'      then profile_visibility
           when 'workouts'     then workouts_visibility
           when 'photos'       then photos_visibility
           when 'weight'       then weight_visibility
           when 'measurements' then measurements_visibility
           when 'streak'       then streak_visibility
         end
    into v
    from public.user_settings
   where user_id = p_owner;

  return public.can_view(p_owner, coalesce(v, 'private'));
end;
$$;

-- -----------------------------------------------------------------------------
alter table public.profiles                   enable row level security;
alter table public.user_settings              enable row level security;
alter table public.exercises                  enable row level security;
alter table public.workout_templates          enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.workouts                   enable row level security;
alter table public.workout_exercises          enable row level security;
alter table public.body_measurements          enable row level security;
alter table public.progress_photos            enable row level security;
alter table public.personal_records           enable row level security;
alter table public.followers                  enable row level security;
alter table public.workout_likes              enable row level security;
alter table public.workout_comments           enable row level security;
alter table public.notifications              enable row level security;
alter table public.video_exports              enable row level security;
alter table public.analytics_events           enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles for select
  using (deleted_at is null and (id = auth.uid() or public.can_view_setting(id, 'profile')));

create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- DELETE não tem policy: a conta é removida pelo Auth, com cascade.

-- -----------------------------------------------------------------------------
-- user_settings — sempre privado
-- -----------------------------------------------------------------------------
create policy user_settings_select on public.user_settings for select to authenticated
  using (user_id = auth.uid());
create policy user_settings_insert on public.user_settings for insert to authenticated
  with check (user_id = auth.uid());
create policy user_settings_update on public.user_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- exercises — biblioteca do sistema é legível por todos
-- -----------------------------------------------------------------------------
create policy exercises_select on public.exercises for select
  using (deleted_at is null and (owner_id is null or owner_id = auth.uid()));

create policy exercises_insert on public.exercises for insert to authenticated
  with check (owner_id = auth.uid());
create policy exercises_update on public.exercises for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy exercises_delete on public.exercises for delete to authenticated
  using (owner_id = auth.uid());

-- -----------------------------------------------------------------------------
-- templates — owner_id NULL são as sugestões do sistema
-- -----------------------------------------------------------------------------
create policy templates_select on public.workout_templates for select
  using (deleted_at is null and (owner_id is null or owner_id = auth.uid()));

create policy templates_insert on public.workout_templates for insert to authenticated
  with check (owner_id = auth.uid());
create policy templates_update on public.workout_templates for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy templates_delete on public.workout_templates for delete to authenticated
  using (owner_id = auth.uid());

-- itens do template seguem a visibilidade do template pai
create policy tpl_exercises_select on public.workout_template_exercises for select
  using (exists (select 1 from public.workout_templates t where t.id = template_id));

create policy tpl_exercises_write on public.workout_template_exercises for all to authenticated
  using (exists (
    select 1 from public.workout_templates t
     where t.id = template_id and t.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_templates t
     where t.id = template_id and t.owner_id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- workouts
-- -----------------------------------------------------------------------------
create policy workouts_select on public.workouts for select
  using (deleted_at is null and (user_id = auth.uid() or public.can_view(user_id, visibility)));

create policy workouts_insert on public.workouts for insert to authenticated
  with check (user_id = auth.uid());
create policy workouts_update on public.workouts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy workouts_delete on public.workouts for delete to authenticated
  using (user_id = auth.uid());

-- os exercícios do treino herdam a RLS do treino pai pelo próprio EXISTS
create policy workout_exercises_select on public.workout_exercises for select
  using (exists (select 1 from public.workouts w where w.id = workout_id));

create policy workout_exercises_write on public.workout_exercises for all to authenticated
  using (exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- medidas e fotos
-- -----------------------------------------------------------------------------
create policy measurements_select on public.body_measurements for select
  using (deleted_at is null
         and (user_id = auth.uid() or public.can_view_setting(user_id, 'measurements')));

create policy measurements_insert on public.body_measurements for insert to authenticated
  with check (user_id = auth.uid());
create policy measurements_update on public.body_measurements for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy measurements_delete on public.body_measurements for delete to authenticated
  using (user_id = auth.uid());

create policy photos_select on public.progress_photos for select
  using (deleted_at is null and (user_id = auth.uid() or public.can_view(user_id, visibility)));

-- Toda foto nasce privada. Publicar exige um UPDATE explícito do dono — nenhum
-- caminho de código consegue publicar automaticamente.
create policy photos_insert on public.progress_photos for insert to authenticated
  with check (user_id = auth.uid() and visibility = 'private');

create policy photos_update on public.progress_photos for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy photos_delete on public.progress_photos for delete to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- recordes — leitura e remoção pelo dono; gravação só pelo trigger
-- -----------------------------------------------------------------------------
create policy records_select on public.personal_records for select to authenticated
  using (user_id = auth.uid());
create policy records_delete on public.personal_records for delete to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- comunidade
-- -----------------------------------------------------------------------------
create policy followers_select on public.followers for select to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

create policy followers_insert on public.followers for insert to authenticated
  with check (
    follower_id = auth.uid()
    and exists (select 1 from public.user_settings s
                 where s.user_id = following_id and s.allow_followers)
  );

create policy followers_update on public.followers for update to authenticated
  using (following_id = auth.uid()) with check (following_id = auth.uid());

create policy followers_delete on public.followers for delete to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

create policy likes_select on public.workout_likes for select
  using (exists (select 1 from public.workouts w where w.id = workout_id));

create policy likes_insert on public.workout_likes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id)
  );

create policy likes_delete on public.workout_likes for delete to authenticated
  using (user_id = auth.uid());

create policy comments_select on public.workout_comments for select
  using (deleted_at is null and exists (select 1 from public.workouts w where w.id = workout_id));

create policy comments_insert on public.workout_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id)
  );

create policy comments_update on public.workout_comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- o autor apaga o próprio comentário; o dono do treino modera o seu treino
create policy comments_delete on public.workout_comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- notificações, exports e eventos
-- -----------------------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy exports_select on public.video_exports for select to authenticated
  using (user_id = auth.uid());
create policy exports_insert on public.video_exports for insert to authenticated
  with check (user_id = auth.uid() and status = 'queued');
create policy exports_delete on public.video_exports for delete to authenticated
  using (user_id = auth.uid());
-- UPDATE não tem policy: quem move a fila é o worker, com service role.

create policy analytics_insert on public.analytics_events for insert to authenticated
  with check (user_id = auth.uid());
