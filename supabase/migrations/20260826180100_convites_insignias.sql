-- =============================================================================
-- P20X · 0025 — as insígnias de convite
--
-- Separado da migration anterior porque o Postgres não deixa usar um valor de
-- enum novo na mesma transação em que ele foi criado.
-- =============================================================================

insert into public.badges (slug, name, description, metric, threshold, tier, emblem, sort_order) values
  ('arauto',      'Arauto',      'Uma pessoa entrou no P20X pelo seu convite.',                  'convites',  1, 'bronze', 'corneta',     280),
  ('recrutador',  'Recrutador',  'Cinco pessoas entraram pelo seu convite. Isso já é um grupo.', 'convites',  5, 'prata',  'estandarte',  281),
  ('legiao',      'Legião',      'Dez pessoas entraram pelo seu convite. Você formou uma.',      'convites', 10, 'ouro',   'legiao',      282)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- O cálculo passa a contar convites
-- -----------------------------------------------------------------------------
create or replace function public.conceder_conquistas(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dias          numeric;
  sequencia     numeric;
  minutos       numeric;
  barras        numeric;
  flexoes       numeric;
  agachamentos  numeric;
  abdominais    numeric;
  fotos         numeric;
  madrugada     numeric;
  fim_de_semana numeric;
  convites      numeric;
  fundador      boolean;
  fuso          text;
begin
  select coalesce(timezone, 'America/Sao_Paulo') into fuso
    from public.profiles where id = p_user;

  select count(distinct workout_date) into dias
    from public.workouts where user_id = p_user and deleted_at is null;

  select coalesce(round(sum(duration_seconds) / 60.0), 0) into minutos
    from public.workouts where user_id = p_user and deleted_at is null;

  with dias_distintos as (
    select distinct workout_date as dia
      from public.workouts where user_id = p_user and deleted_at is null
  ),
  agrupados as (
    select dia, dia - (row_number() over (order by dia))::int as grupo from dias_distintos
  )
  select coalesce(max(tamanho), 0) into sequencia
    from (select count(*) as tamanho from agrupados group by grupo) t;

  select count(*) into madrugada
    from public.workouts
   where user_id = p_user and deleted_at is null
     and extract(hour from (started_at at time zone fuso)) < 6;

  select count(*) into fim_de_semana
    from public.workouts
   where user_id = p_user and deleted_at is null
     and extract(isodow from workout_date) in (6, 7);

  select count(*) into fotos
    from public.progress_photos where user_id = p_user and deleted_at is null;

  select public.contar_convites(p_user) into convites;

  select
    coalesce(sum(case when e.slug like 'barra%'       then t.vol end), 0),
    coalesce(sum(case when e.slug like 'flexao%'      then t.vol end), 0),
    coalesce(sum(case when e.slug like 'agachamento%' then t.vol end), 0),
    coalesce(sum(case when e.category = 'abdomen'     then t.vol end), 0)
    into barras, flexoes, agachamentos, abdominais
    from (
      select we.exercise_id,
             coalesce(we.sets, w.rounds, 1) * coalesce(we.repetitions, 0) as vol
        from public.workout_exercises we
        join public.workouts w on w.id = we.workout_id
       where w.user_id = p_user and w.deleted_at is null
    ) t
    join public.exercises e on e.id = t.exercise_id;

  select created_at < timestamptz '2027-08-22' into fundador
    from public.profiles where id = p_user;

  insert into public.user_badges (user_id, badge_slug, value)
  select p_user, b.slug,
         case b.metric
           when 'dias'          then dias
           when 'sequencia'     then sequencia
           when 'minutos'       then minutos
           when 'barras'        then barras
           when 'flexoes'       then flexoes
           when 'agachamentos'  then agachamentos
           when 'abdominais'    then abdominais
           when 'fotos'         then fotos
           when 'madrugada'     then madrugada
           when 'fim_de_semana' then fim_de_semana
           when 'convites'      then convites
           else null
         end
    from public.badges b
   where case b.metric
           when 'dias'          then dias          >= b.threshold
           when 'sequencia'     then sequencia     >= b.threshold
           when 'minutos'       then minutos       >= b.threshold
           when 'barras'        then barras        >= b.threshold
           when 'flexoes'       then flexoes       >= b.threshold
           when 'agachamentos'  then agachamentos  >= b.threshold
           when 'abdominais'    then abdominais    >= b.threshold
           when 'fotos'         then fotos         >= b.threshold
           when 'madrugada'     then madrugada     >= b.threshold
           when 'fim_de_semana' then fim_de_semana >= b.threshold
           when 'convites'      then convites      >= b.threshold
           when 'fundador'      then coalesce(fundador, false)
         end
  on conflict (user_id, badge_slug) do nothing;

  delete from public.user_badges ub
   using public.badges b
   where ub.user_id = p_user
     and b.slug = ub.badge_slug
     and b.metric <> 'fundador'
     and case b.metric
           when 'dias'          then dias          < b.threshold
           when 'sequencia'     then sequencia     < b.threshold
           when 'minutos'       then minutos       < b.threshold
           when 'barras'        then barras        < b.threshold
           when 'flexoes'       then flexoes       < b.threshold
           when 'agachamentos'  then agachamentos  < b.threshold
           when 'abdominais'    then abdominais    < b.threshold
           when 'fotos'         then fotos         < b.threshold
           when 'madrugada'     then madrugada     < b.threshold
           when 'fim_de_semana' then fim_de_semana < b.threshold
           when 'convites'      then convites      < b.threshold
         end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Terminar o onboarding é o que faz o convite valer
-- -----------------------------------------------------------------------------
create or replace function public.conquistas_do_padrinho()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referred_by is not null
     and new.onboarding_completed_at is not null
     and (old.onboarding_completed_at is null or old.referred_by is distinct from new.referred_by)
  then
    perform public.conceder_conquistas(new.referred_by);
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_conquistas_do_padrinho on public.profiles;
create trigger profiles_conquistas_do_padrinho
  after update of onboarding_completed_at, referred_by on public.profiles
  for each row execute function public.conquistas_do_padrinho();
