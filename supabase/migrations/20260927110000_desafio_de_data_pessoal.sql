-- =============================================================================
-- P20X · 0048 — desafio com data escolhida pela pessoa
--
-- O desafio do mês tem data para todo mundo: é o que faz dele um evento. O de
-- açúcar não é evento, é decisão — e quem decide parar com açúcar numa quinta
-- não deveria esperar até o dia 3 do mês que vem. Cada um começa os seus 21
-- dias quando quiser.
--
-- Três decisões:
--
-- 1. **`duration_days` liga o modo pessoal.** Nulo, o desafio é como sempre foi:
--    janela única. Preenchido, cada participante tem a própria janela, de
--    `started_on` até `started_on + duration_days - 1`, e as datas do desafio
--    passam a dizer quando dá para COMEÇAR — não quando ele acontece.
--
-- 2. **A data de início é conferida no banco, por trigger.** Hoje ou até 30 dias
--    à frente, no fuso da pessoa, e dentro do período em que o desafio aceita
--    começos. Começar no passado não daria vantagem (só se marca hoje e ontem),
--    mas faria a linha do tempo nascer cheia de dias "sem marca" que a pessoa
--    nunca teve chance de vencer.
--
-- 3. **Só conta marcação feita depois de entrar.** Sair e entrar de novo é
--    recomeçar, e recomeçar com dias antigos já vencidos não é recomeço.
-- =============================================================================

alter table public.challenges
  add column if not exists duration_days integer;

alter table public.challenges
  add constraint challenge_duracao check (duration_days is null or duration_days between 1 and 366),
  add constraint challenge_meta_cabe check (duration_days is null or goal <= duration_days);

comment on column public.challenges.duration_days is
  'Nulo: janela única (starts_on a ends_on). Preenchido: cada pessoa escolhe o início, e starts_on/ends_on dizem quando dá para começar.';

alter table public.challenge_participants
  add column if not exists started_on date;

comment on column public.challenge_participants.started_on is
  'Início escolhido pela pessoa, só em desafio com duration_days. Nulo nos de janela única.';

-- -----------------------------------------------------------------------------
-- A data de início, conferida
-- -----------------------------------------------------------------------------
create or replace function public.conferir_inicio_no_desafio()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d    public.challenges%rowtype;
  hoje date;
begin
  select * into d from public.challenges where id = new.challenge_id;

  if d.duration_days is null then
    -- janela única: a data é a do desafio, e ninguém escolhe
    new.started_on := null;
    return new;
  end if;

  select (now() at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date
    into hoje
    from public.profiles p
   where p.id = new.user_id;

  hoje := coalesce(hoje, (now() at time zone 'America/Sao_Paulo')::date);
  new.started_on := coalesce(new.started_on, hoje);

  if new.started_on < hoje or new.started_on > hoje + 30 then
    raise exception 'inicio_fora_do_prazo' using errcode = 'P0001';
  end if;

  if new.started_on < d.starts_on or new.started_on > d.ends_on then
    raise exception 'inicio_fora_do_periodo' using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

revoke execute on function public.conferir_inicio_no_desafio() from public, anon, authenticated;

create trigger challenge_participants_inicio
  before insert on public.challenge_participants
  for each row execute function public.conferir_inicio_no_desafio();

-- -----------------------------------------------------------------------------
-- A janela de cada um
--
-- Uma função, para a marcação e a contagem nunca discordarem sobre onde a
-- janela de alguém começa e termina.
-- -----------------------------------------------------------------------------
create or replace function public.janela_no_desafio(p_challenge uuid, p_user uuid)
returns table (inicio date, fim date)
language sql
security definer
set search_path = public
stable
as $fn$
  select
    case when c.duration_days is null then c.starts_on else cp.started_on end,
    case when c.duration_days is null then c.ends_on
         else cp.started_on + c.duration_days - 1 end
    from public.challenges c
    left join public.challenge_participants cp
      on cp.challenge_id = c.id and cp.user_id = p_user
   where c.id = p_challenge
     -- no modo pessoal, sem inscrição não há janela
     and (c.duration_days is null or cp.started_on is not null);
$fn$;

revoke execute on function public.janela_no_desafio(uuid, uuid) from public, anon, authenticated;

create or replace function public.dias_cumpridos(p_challenge uuid, p_user uuid)
returns setof date
language sql
security definer
set search_path = public
stable
as $fn$
  select distinct w.workout_date
    from public.challenges c
    cross join public.janela_no_desafio(c.id, p_user) j
    join public.workouts w
      on w.user_id = p_user
     and w.deleted_at is null
     and w.finished_at is not null
     and w.workout_date between j.inicio and j.fim
   where c.id = p_challenge and c.kind = 'treino'
  union
  select k.day
    from public.challenges c
    cross join public.janela_no_desafio(c.id, p_user) j
    join public.challenge_participants cp
      on cp.challenge_id = c.id and cp.user_id = p_user
    join public.challenge_checkins k
      on k.challenge_id = c.id
     and k.user_id = p_user
     and k.day between j.inicio and j.fim
     -- marcação de uma participação anterior não vale para a atual
     and k.created_at >= cp.joined_at
   where c.id = p_challenge and c.kind = 'alimentacao';
$fn$;

revoke execute on function public.dias_cumpridos(uuid, uuid) from public, anon, authenticated;

create or replace function public.marcar_dia_no_desafio(p_slug text, p_day date, p_feito boolean default true)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d    public.challenges%rowtype;
  j    record;
  hoje date;
begin
  if auth.uid() is null then
    return 'sem_sessao';
  end if;

  select * into d from public.challenges where slug = p_slug and is_active;
  if not found then
    return 'nao_encontrado';
  end if;

  if d.kind <> 'alimentacao' then
    return 'nao_e_de_marcar';
  end if;

  if not exists (
    select 1 from public.challenge_participants
     where challenge_id = d.id and user_id = auth.uid()
  ) then
    return 'nao_participa';
  end if;

  select * into j from public.janela_no_desafio(d.id, auth.uid());

  if not found or p_day < j.inicio or p_day > j.fim then
    return 'fora_da_janela';
  end if;

  select (now() at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date
    into hoje
    from public.profiles p
   where p.id = auth.uid();

  hoje := coalesce(hoje, (now() at time zone 'America/Sao_Paulo')::date);

  if p_day > hoje or p_day < hoje - 1 then
    return 'fora_do_prazo';
  end if;

  if p_feito then
    -- remarcar o mesmo dia renova o `created_at`: quem saiu, voltou e marcou
    -- de novo precisa que a marcação conte para a participação atual
    insert into public.challenge_checkins (challenge_id, user_id, day)
    values (d.id, auth.uid(), p_day)
    on conflict (challenge_id, user_id, day) do update set created_at = now();
  else
    delete from public.challenge_checkins
     where challenge_id = d.id and user_id = auth.uid() and day = p_day;
  end if;

  return 'ok';
end;
$fn$;

revoke execute on function public.marcar_dia_no_desafio(text, date, boolean) from public, anon, authenticated;
grant execute on function public.marcar_dia_no_desafio(text, date, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 21 dias sem açúcar passa a ter data pessoal
--
-- Aberto para começar a partir de hoje, sem data para fechar. Continua
-- desligado: quem publica é o admin.
-- -----------------------------------------------------------------------------
update public.challenges
   set duration_days = 21,
       starts_on     = date '2026-09-27',
       ends_on       = date '2099-12-31'
 where slug = '21-dias-sem-acucar';
