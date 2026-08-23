-- =============================================================================
-- P20X · 0020 — catálogo novo e o cálculo das novas conquistas
--
-- Vem separado da migration que estende o enum porque o Postgres não deixa
-- usar um valor de enum novo na mesma transação em que ele foi criado.
-- =============================================================================

insert into public.badges (slug, name, description, metric, threshold, tier, emblem, sort_order) values
  -- Sequência: dias seguidos, sem quebrar
  ('sentinela',   'Sentinela',        'Sete dias seguidos. Quem vigia não dorme no turno.',                    'sequencia',       7, 'bronze',   'torre',      140),
  ('vigilia',     'Vigília',          'Vinte e um dias seguidos. O turno inteiro da guarda romana.',           'sequencia',      21, 'ferro',    'tocha',      141),
  ('muralha-viva','Muralha Viva',     'Cinquenta dias seguidos. Não é mais disciplina, é estrutura.',          'sequencia',      50, 'ferro',    'muralha',    142),
  ('coluna',      'Coluna',           'Cem dias seguidos. O que sustenta o templo não se move.',               'sequencia',     100, 'prata',    'coluna',     143),
  ('inabalavel',  'Inabalável',       'Duzentos dias seguidos. Nem viagem, nem gripe, nem segunda-feira.',     'sequencia',     200, 'ouro',     'ancora',     144),
  ('ano-de-ferro','Ano de Ferro',     'Trezentos e sessenta e cinco dias seguidos. Um ano sem falhar.',        'sequencia',     365, 'imperial', 'louro',      145),

  -- Tempo acumulado debaixo do relógio
  ('forja',       'Forja',            'Dez horas de treino somadas. O metal começa a ceder.',                  'minutos',       600, 'bronze',   'martelo',    150),
  ('bigorna',     'Bigorna',          'Cinquenta horas somadas. O que apanha muito é o que toma forma.',       'minutos',      3000, 'prata',    'bigorna',    151),
  ('aco-temperado','Aço Temperado',   'Cem horas somadas. Temperado é o aço que já passou pelo fogo.',         'minutos',      6000, 'ouro',     'espada',     152),

  -- Volume por movimento
  ('ariete',      'Aríete',           'Mil flexões acumuladas. É assim que se derruba um portão.',             'flexoes',      1000, 'ouro',     'ariete',     230),
  ('marcha',      'Marcha',           'Quinhentos agachamentos. A legião andava trinta quilômetros por dia.',  'agachamentos',  500, 'ferro',    'bota',       240),
  ('bronze-pernas','Pernas de Bronze','Dois mil agachamentos. A base que sustenta todo o resto.',              'agachamentos', 2000, 'ouro',     'coluna',     241),
  ('couraca',     'Couraça',          'Mil abdominais. O tronco é a armadura que você não tira.',              'abdominais',   1000, 'ferro',    'peitoral',   250),

  -- Evidência
  ('testemunha',  'Testemunha',       'Dez fotos de evolução. O espelho esquece; a foto não.',                 'fotos',          10, 'bronze',   'olho',       260),
  ('cronica',     'Crônica',          'Cinquenta fotos. Isso já é um registro de verdade.',                    'fotos',          50, 'prata',    'pergaminho', 261),

  -- Quando você treina diz algo sobre você
  ('antes-do-sol','Antes do Sol',     'Vinte treinos começados antes das seis da manhã.',                      'madrugada',      20, 'prata',    'sol',        270),
  ('sem-tregua',  'Sem Trégua',       'Trinta treinos em sábado ou domingo. Fim de semana também conta.',      'fim_de_semana',  30, 'ferro',    'lancas',     271)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- O cálculo, agora com tudo
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
  fundador      boolean;
  fuso          text;
begin
  select coalesce(timezone, 'America/Sao_Paulo') into fuso
    from public.profiles where id = p_user;

  select count(distinct workout_date) into dias
    from public.workouts where user_id = p_user and deleted_at is null;

  select coalesce(round(sum(duration_seconds) / 60.0), 0) into minutos
    from public.workouts where user_id = p_user and deleted_at is null;

  -- maior sequência de dias consecutivos: ilhas sobre os dias distintos
  with dias_distintos as (
    select distinct workout_date as dia
      from public.workouts where user_id = p_user and deleted_at is null
  ),
  agrupados as (
    select dia, dia - (row_number() over (order by dia))::int as grupo from dias_distintos
  )
  select coalesce(max(tamanho), 0) into sequencia
    from (select count(*) as tamanho from agrupados group by grupo) t;

  -- horário local: quem treina às 5h em Manaus não é madrugador em Brasília
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

  select
    coalesce(sum(case when e.slug like 'barra%'      then t.vol end), 0),
    coalesce(sum(case when e.slug like 'flexao%'     then t.vol end), 0),
    coalesce(sum(case when e.slug like 'agachamento%' then t.vol end), 0),
    coalesce(sum(case when e.category = 'abdomen'    then t.vol end), 0)
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
           when 'fundador'      then coalesce(fundador, false)
         end
  on conflict (user_id, badge_slug) do nothing;

  -- o que deixou de valer sai, como o recorde sai com o treino apagado
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
         end;
end;
$$;

-- a foto agora conta para conquista: o gatilho precisa existir também nela
create or replace function public.conquistas_da_foto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.conceder_conquistas(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists progress_photos_conquistas on public.progress_photos;
create trigger progress_photos_conquistas
  after insert or update of deleted_at or delete on public.progress_photos
  for each row execute function public.conquistas_da_foto();

-- recalcula para quem já está aqui
do $$
declare
  u uuid;
begin
  for u in select id from public.profiles loop
    perform public.conceder_conquistas(u);
  end loop;
end;
$$;
