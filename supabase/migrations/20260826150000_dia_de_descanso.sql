-- =============================================================================
-- P20X · 0023 — dia de descanso
--
-- Descanso não é brecha: é parte do treino. A própria tela de Análise diz que
-- o mesmo padrão de movimento em alta intensidade pede 48 horas, e um app que
-- pune quem respeita isso está ensinando a coisa errada.
--
-- Duas regras seguram o significado do número:
--
-- 1. **Descanso sustenta a sequência, mas não conta como dia treinado.**
--    "17 dias seguidos" continua verdade; "17 dias treinados" também. São
--    perguntas diferentes e o app responde as duas separadamente.
--
-- 2. **No máximo um por semana.** Sem teto, a sequência viraria uma contagem
--    de dias em que a pessoa abriu o aplicativo — que não é o que ela quer
--    saber. O limite é verificado no banco, não na tela.
-- =============================================================================

create table public.rest_days (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- dia local do usuário, como workouts.workout_date
  day        date not null,
  note       text,
  created_at timestamptz not null default now(),

  primary key (user_id, day),

  constraint rest_note_len check (note is null or char_length(note) <= 200)
);

create index rest_days_user_idx on public.rest_days (user_id, day desc);

alter table public.rest_days enable row level security;

create policy "descanso proprio leitura" on public.rest_days for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

create policy "descanso proprio exclusao" on public.rest_days for delete to authenticated
  using (user_id = auth.uid());

-- INSERT não tem policy: entra por `registrar_descanso`, que confere o limite

-- -----------------------------------------------------------------------------
-- Registrar, com as regras no banco
-- -----------------------------------------------------------------------------
create or replace function public.registrar_descanso(p_day date, p_note text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  usados int;
  tem_treino boolean;
begin
  if auth.uid() is null then
    return 'sem_sessao';
  end if;

  -- descansar num dia em que treinou não faz sentido e confundiria a contagem
  select exists (
    select 1 from public.workouts
     where user_id = auth.uid() and workout_date = p_day and deleted_at is null
  ) into tem_treino;

  if tem_treino then
    return 'ja_treinou';
  end if;

  -- um por semana, contando os sete dias que terminam no dia escolhido
  select count(*) into usados
    from public.rest_days
   where user_id = auth.uid()
     and day between p_day - 6 and p_day + 6;

  if usados >= 1 then
    return 'limite';
  end if;

  insert into public.rest_days (user_id, day, note)
  values (auth.uid(), p_day, nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (user_id, day) do nothing;

  return 'ok';
end;
$$;

comment on function public.registrar_descanso is
  'Registra um dia de descanso. Um por semana, e nunca num dia em que houve treino.';

-- -----------------------------------------------------------------------------
-- A sequência passa a enxergar o descanso
--
-- `total_days` continua contando só treino: é o número que responde "quanto
-- você treinou". A sequência é a que ganha o descanso como elo, porque ela
-- responde outra coisa — "há quanto tempo você não abandona isso".
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
  treinados as (
    select distinct workout_date as day
      from public.workouts
     where user_id = p_user and deleted_at is null
  ),
  -- o descanso entra apenas na cadeia, e só quando não há treino no mesmo dia
  elos as (
    select day from treinados
    union
    select r.day from public.rest_days r
     where r.user_id = p_user
       and not exists (select 1 from treinados t where t.day = r.day)
  ),
  grouped as (
    select day, day - (row_number() over (order by day))::int as grp from elos
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
    (select count(*)::int from treinados),
    (select coalesce(sum(duration_seconds), 0)::bigint from public.workouts
      where user_id = p_user and deleted_at is null),
    (select max(day) from treinados);
$$;

comment on function public.get_user_stats is
  'Sequência e totais. A sequência conta dias de descanso como elo; total_days, não.';
