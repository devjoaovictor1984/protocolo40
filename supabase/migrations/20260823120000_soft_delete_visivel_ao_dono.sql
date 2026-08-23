-- =============================================================================
-- P20X · 0008 — o dono enxerga o próprio registro apagado
--
-- As policies de SELECT filtravam `deleted_at is null`. Isso torna o soft
-- delete impossível: ao marcar `deleted_at`, a linha deixa de ser visível para
-- quem a apagou, e o PostgreSQL aplica as policies de SELECT ao RETURNING de um
-- UPDATE. O resultado era
--
--   new row violates row-level security policy for table "workouts"
--
-- e o registro nunca era apagado no servidor.
--
-- A regra passa a ser: o dono vê tudo que é dele, apagado ou não; estranhos
-- continuam vendo apenas o que não foi apagado e está compartilhado. Filtrar o
-- que foi apagado é responsabilidade de quem consulta, e a aplicação já faz
-- isso — o que abre caminho, no futuro, para desfazer uma exclusão.
-- =============================================================================

drop policy if exists workouts_select on public.workouts;

create policy workouts_select on public.workouts for select
  using (
    user_id = auth.uid()
    or (deleted_at is null and public.can_view(user_id, visibility))
  );

drop policy if exists measurements_select on public.body_measurements;

create policy measurements_select on public.body_measurements for select
  using (
    user_id = auth.uid()
    or (deleted_at is null and public.can_view_setting(user_id, 'measurements'))
  );

drop policy if exists photos_select on public.progress_photos;

create policy photos_select on public.progress_photos for select
  using (
    user_id = auth.uid()
    or (deleted_at is null and public.can_view(user_id, visibility))
  );

drop policy if exists comments_select on public.workout_comments;

create policy comments_select on public.workout_comments for select
  using (
    user_id = auth.uid()
    or (
      deleted_at is null
      and exists (select 1 from public.workouts w where w.id = workout_id)
    )
  );

-- Perfis e exercícios seguem a mesma lógica, para que desativar não trave o
-- próprio dono.
drop policy if exists profiles_select on public.profiles;

create policy profiles_select on public.profiles for select
  using (
    id = auth.uid()
    or (deleted_at is null and public.can_view_setting(id, 'profile'))
  );

drop policy if exists exercises_select on public.exercises;

create policy exercises_select on public.exercises for select
  using (
    owner_id = auth.uid()
    or (deleted_at is null and owner_id is null)
  );

drop policy if exists templates_select on public.workout_templates;

create policy templates_select on public.workout_templates for select
  using (
    owner_id = auth.uid()
    or (deleted_at is null and owner_id is null)
  );
