-- =============================================================================
-- P20X · 0052 — a trilha do novato: estrutura
--
-- A estrutura vai antes do deploy e o programa depois (arquivo seguinte). O
-- código novo lê as colunas novas; o código antigo não sabe o que é uma sessão
-- de descanso nem um treino guiado. Tudo aqui é compatível com os dois: colunas
-- que o código antigo ignora, e o descanso passando a contar na trilha.
--
-- O porquê do programa inteiro está no cabeçalho do arquivo seguinte.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- O treino guiado: quantas voltas e quanto descanso
--
-- Três colunas, e não um JSON: são números que a tela lê e o banco confere.
-- Nulas em quem não é guiado — AMRAP e livre não têm voltas marcadas.
-- -----------------------------------------------------------------------------
alter table public.workout_templates
  add column if not exists rounds             smallint,
  add column if not exists rest_seconds       smallint,
  add column if not exists round_rest_seconds smallint;

alter table public.workout_templates
  add constraint template_guiado_voltas   check (rounds is null or rounds between 1 and 20),
  add constraint template_guiado_descanso check (rest_seconds is null or rest_seconds between 0 and 600),
  add constraint template_guiado_entre    check (round_rest_seconds is null or round_rest_seconds between 0 and 600),
  -- guiado sem voltas não tem o que conduzir
  add constraint template_guiado_completo check (method <> 'guiado' or rounds is not null);

comment on column public.workout_templates.rounds is 'Treino guiado: quantas voltas do circuito.';
comment on column public.workout_templates.rest_seconds is 'Treino guiado: descanso entre um exercício e o próximo.';
comment on column public.workout_templates.round_rest_seconds is 'Treino guiado: descanso entre uma volta e a seguinte.';

-- -----------------------------------------------------------------------------
-- Sessão de descanso não tem circuito
-- -----------------------------------------------------------------------------
alter table public.track_sessions alter column template_id drop not null;

alter table public.track_sessions
  add constraint track_session_descanso check ((focus = 'descanso') = (template_id is null));

-- -----------------------------------------------------------------------------
-- O descanso registrado conta como dia da trilha
-- -----------------------------------------------------------------------------
create or replace function public.meus_dias_na_trilha(p_slug text)
returns setof date
language sql
security invoker
set search_path = public
stable
as $fn$
  select dia from (
    select w.workout_date as dia
      from public.workouts w
      join public.track_enrollments m on m.user_id = auth.uid()
      join public.tracks t on t.id = m.track_id and t.slug = p_slug and t.is_active
     where w.user_id = auth.uid()
       and w.deleted_at is null
       and w.finished_at is not null
       and w.workout_date >= m.started_on
    union
    select r.day
      from public.rest_days r
      join public.track_enrollments m on m.user_id = auth.uid()
      join public.tracks t on t.id = m.track_id and t.slug = p_slug and t.is_active
     where r.user_id = auth.uid()
       and r.day >= m.started_on
  ) dias
  order by 1;
$fn$;

create or replace function public.concluir_trilha(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t       public.tracks%rowtype;
  m       public.track_enrollments%rowtype;
  sessoes integer;
  feitos  integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into t from public.tracks where slug = p_slug and is_active;
  if not found then
    return false;
  end if;

  select * into m from public.track_enrollments
   where track_id = t.id and user_id = auth.uid();
  if not found or m.completed_at is not null then
    return false;
  end if;

  select count(*) into sessoes from public.track_sessions where track_id = t.id;

  select count(*) into feitos from (
    select w.workout_date
      from public.workouts w
     where w.user_id = auth.uid()
       and w.deleted_at is null
       and w.finished_at is not null
       and w.workout_date >= m.started_on
    union
    select r.day
      from public.rest_days r
     where r.user_id = auth.uid()
       and r.day >= m.started_on
  ) dias;

  if sessoes = 0 or feitos < sessoes then
    return false;
  end if;

  update public.track_enrollments
     set completed_at = now()
   where track_id = t.id and user_id = auth.uid();

  if t.badge_slug is not null then
    insert into public.user_badges (user_id, badge_slug, value)
    values (auth.uid(), t.badge_slug, feitos)
    on conflict (user_id, badge_slug) do nothing;
  end if;

  return true;
end;
$fn$;

revoke execute on function public.meus_dias_na_trilha(text) from public, anon, authenticated;
revoke execute on function public.concluir_trilha(text)     from public, anon, authenticated;
grant execute on function public.meus_dias_na_trilha(text) to authenticated;
grant execute on function public.concluir_trilha(text)     to authenticated;

-- -----------------------------------------------------------------------------
-- "Agora não"
--
-- A trilha é oferecida a todo novato, e recusar precisa valer. Sem guardar a
-- recusa, o convite voltaria em toda abertura do app — e convite que não aceita
-- "não" vira cobrança. No perfil, e não no aparelho, para valer no celular e no
-- computador.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists track_offer_declined_at timestamptz;

comment on column public.profiles.track_offer_declined_at is
  'Quando a pessoa recusou o convite da trilha na tela de Hoje. A trilha continua acessível em /trilha.';
