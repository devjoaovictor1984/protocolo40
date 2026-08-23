-- =============================================================================
-- P20X · 0015 — conquistas
--
-- Emblema é dado pelo banco, nunca pelo cliente: a mesma razão do recorde.
-- O catálogo mora aqui porque é dado, não código — acrescentar um nível novo é
-- uma linha de seed, e o app desenha a partir da coluna `emblem`.
--
-- A escada principal conta DIAS TREINADOS acumulados, não sequência: quem
-- perdeu um dia não perde o que já conquistou.
-- =============================================================================

create type public.badge_metric as enum ('dias', 'barras', 'flexoes', 'fundador');
create type public.badge_tier   as enum ('bronze', 'ferro', 'prata', 'ouro', 'imperial');

create table public.badges (
  slug        text primary key,
  name        text not null,
  description text not null,
  metric      public.badge_metric not null,
  threshold   numeric not null default 0,
  tier        public.badge_tier not null,
  -- chave do desenho do emblema no cliente
  emblem      text not null,
  sort_order  smallint not null,

  constraint badge_name_len check (char_length(name) between 2 and 40)
);

create table public.user_badges (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_slug text not null references public.badges (slug) on delete cascade,
  earned_on  date not null default current_date,
  -- o número que valeu a conquista no momento em que ela caiu
  value      numeric,
  created_at timestamptz not null default now(),

  primary key (user_id, badge_slug)
);

create index user_badges_user_idx on public.user_badges (user_id, earned_on desc);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

-- o catálogo é público: a próxima conquista precisa ser visível para motivar
create policy "badges leitura" on public.badges for select to anon, authenticated using (true);

create policy "conquista propria" on public.user_badges for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

-- ninguém insere conquista à mão: quem concede é a função, com SECURITY DEFINER
create policy "conquista admin apaga" on public.user_badges for delete to authenticated
  using (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Catálogo
-- -----------------------------------------------------------------------------
insert into public.badges (slug, name, description, metric, threshold, tier, emblem, sort_order) values
  ('recruta',     'Recruta',             'O primeiro treino registrado. Todo exército começa com um dia.',            'dias',       1, 'bronze',   'recruta',     10),
  ('legionario',  'Legionário',          'Sete dias treinados. Você já não está testando — está treinando.',          'dias',       7, 'bronze',   'legionario',  20),
  ('hastati',     'Hastati',             'Quinze dias. A primeira linha da legião era a mais jovem, e avançava.',     'dias',      15, 'bronze',   'hastati',     30),
  ('principes',   'Príncipe',            'Vinte e um dias — o tempo que um hábito leva para parar de doer.',          'dias',      21, 'ferro',    'principes',   40),
  ('triario',     'Triário',             'Trinta dias. O veterano que só entrava quando a batalha apertava.',         'dias',      30, 'ferro',    'triario',     50),
  ('optio',       'Optio',               'Sessenta dias. O segundo em comando: segura a linha sem ser mandado.',      'dias',      60, 'ferro',    'optio',       60),
  ('centuriao',   'Centurião',           'Noventa dias. Cem homens sob comando — e o seu, sob controle.',             'dias',      90, 'prata',    'centuriao',   70),
  ('aquilifero',  'Aquilífero',          'Cento e vinte dias. Quem carrega a águia não recua com ela.',               'dias',     120, 'prata',    'aquilifero',  80),
  ('primus',      'Primus Pilus',        'Cento e cinquenta dias. O primeiro centurião da legião inteira.',           'dias',     150, 'prata',    'primus',      90),
  ('pretoriano',  'Pretoriano',          'Duzentos dias. A guarda de elite — escolhida, nunca convocada.',            'dias',     200, 'ouro',     'pretoriano', 100),
  ('tribuno',     'Tribuno',             'Duzentos e cinquenta dias. Comando, não obediência.',                       'dias',     250, 'ouro',     'tribuno',    110),
  ('legado',      'Legado',              'Trezentos dias. Uma legião inteira responde por você.',                     'dias',     300, 'ouro',     'legado',     120),
  ('imperator',   'Imperator',           'Trezentos e sessenta dias treinados. Um ano inteiro de disciplina.',        'dias',     360, 'imperial', 'imperator',  130),

  ('gancho',      'Escalador',           'Cem barras acumuladas. Muralha nenhuma é alta demais.',                     'barras',   100, 'ferro',    'gancho',     200),
  ('muralha',     'Tomador de Muralhas', 'Mil barras acumuladas. Poucos chegam aqui.',                                'barras',  1000, 'ouro',     'muralha',    210),
  ('falange',     'Falange',             'Cem flexões acumuladas. A formação só existe enquanto ninguém recua.',      'flexoes',  100, 'ferro',    'falange',    220),

  ('fundador',    'Fundador',            'Entrou no P20X no primeiro ano. Esta insígnia não será dada de novo.',      'fundador',   0, 'imperial', 'fundador',   300)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Concessão
--
-- Volume por exercício segue a mesma convenção do resto do app:
-- `sets × repetições`. Quando o treino é AMRAP, `sets` vem nulo e quem conta
-- quantas vezes o exercício foi feito é o número de rounds.
-- -----------------------------------------------------------------------------
create or replace function public.conceder_conquistas(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  dias     numeric;
  barras   numeric;
  flexoes  numeric;
  fundador boolean;
begin
  select count(distinct workout_date) into dias
    from public.workouts where user_id = p_user and deleted_at is null;

  select
    coalesce(sum(case when e.slug like 'barra%'  then t.vol end), 0),
    coalesce(sum(case when e.slug like 'flexao%' then t.vol end), 0)
    into barras, flexoes
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

  -- o que foi alcançado entra
  insert into public.user_badges (user_id, badge_slug, value)
  select p_user, b.slug,
         case b.metric
           when 'dias'    then dias
           when 'barras'  then barras
           when 'flexoes' then flexoes
           else null
         end
    from public.badges b
   where case b.metric
           when 'dias'     then dias    >= b.threshold
           when 'barras'   then barras  >= b.threshold
           when 'flexoes'  then flexoes >= b.threshold
           when 'fundador' then coalesce(fundador, false)
         end
  on conflict (user_id, badge_slug) do nothing;

  -- e o que deixou de valer sai: apagar um treino desfaz a conquista que ele
  -- sustentava, do mesmo jeito que desfaz o recorde
  delete from public.user_badges ub
   using public.badges b
   where ub.user_id = p_user
     and b.slug = ub.badge_slug
     and b.metric <> 'fundador'
     and case b.metric
           when 'dias'    then dias    < b.threshold
           when 'barras'  then barras  < b.threshold
           when 'flexoes' then flexoes < b.threshold
         end;
end;
$$;

comment on function public.conceder_conquistas is
  'Recalcula as conquistas do usuário: concede o que foi alcançado e retira o que deixou de valer.';

-- -----------------------------------------------------------------------------
-- Gatilhos
-- -----------------------------------------------------------------------------
create or replace function public.conquistas_do_treino()
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

create trigger workouts_conquistas
  after insert or update or delete on public.workouts
  for each row execute function public.conquistas_do_treino();

create or replace function public.conquistas_do_exercicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dono uuid;
begin
  select user_id into dono from public.workouts
   where id = coalesce(new.workout_id, old.workout_id);

  if dono is not null then
    perform public.conceder_conquistas(dono);
  end if;

  return coalesce(new, old);
end;
$$;

create trigger workout_exercises_conquistas
  after insert or update or delete on public.workout_exercises
  for each row execute function public.conquistas_do_exercicio();

-- quem chega ganha a insígnia de fundador na hora
create or replace function public.conquistas_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.conceder_conquistas(new.id);
  return new;
end;
$$;

create trigger profiles_conquistas
  after insert on public.profiles
  for each row execute function public.conquistas_do_perfil();

-- -----------------------------------------------------------------------------
-- Quem já estava aqui
-- -----------------------------------------------------------------------------
do $$
declare
  u uuid;
begin
  for u in select id from public.profiles loop
    perform public.conceder_conquistas(u);
  end loop;
end;
$$;
