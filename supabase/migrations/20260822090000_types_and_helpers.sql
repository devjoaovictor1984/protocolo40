-- =============================================================================
-- PROTOCOLO40 · 0001 — tipos e helpers
-- Tipos enumerados do domínio e o trigger de updated_at usado por todas as
-- tabelas mutáveis.
-- =============================================================================

create type public.visibility     as enum ('private', 'followers', 'public');
create type public.workout_level  as enum ('iniciante', 'intermediario', 'avancado');
create type public.workout_place  as enum ('casa', 'academia', 'externa', 'misto');
create type public.workout_goal   as enum (
  'perder_gordura', 'ganhar_forca', 'condicionamento', 'ganhar_massa',
  'melhorar_shape', 'criar_disciplina', 'manter_saude', 'outro'
);
create type public.exercise_cat   as enum (
  'peito', 'costas', 'ombros', 'bracos', 'pernas',
  'abdomen', 'cardio', 'mobilidade', 'corpo_inteiro'
);
-- como o exercício é medido: repetições, tempo, distância ou carga
create type public.exercise_mode  as enum ('reps', 'time', 'distance', 'load');
create type public.record_metric  as enum ('reps', 'duration', 'distance', 'weight', 'rounds', 'volume');
create type public.export_status  as enum ('queued', 'processing', 'completed', 'failed', 'canceled');
create type public.follow_status  as enum ('pending', 'accepted');
create type public.photo_pose     as enum ('frente', 'lado', 'costas', 'outro');
create type public.theme_pref     as enum ('light', 'dark', 'system');

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger BEFORE UPDATE: mantém updated_at sem depender da aplicação.';
