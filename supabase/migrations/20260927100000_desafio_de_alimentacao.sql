-- =============================================================================
-- P20X · 0047 — desafio de alimentação
--
-- Até aqui todo desafio contava treino: o dia cumprido era um dia com treino
-- terminado. "21 dias sem açúcar" não tem treino para contar — quem sabe se o
-- dia foi vencido é a própria pessoa, e ela diz isso marcando o dia.
--
-- Quatro decisões:
--
-- 1. **O tipo mora no desafio, não na regra.** `kind` diz DE ONDE sai o dia
--    cumprido (treino ou marcação); `rule` continua dizendo COMO se conta.
--    Assim janela, meta, folga, ranking e insígnia valem igual para os dois.
--
-- 2. **Só se marca o dia vencido.** Não existe "falhei hoje". Escorregar é não
--    marcar, e o dia seguinte começa limpo — nada zera. Guardar a falha seria
--    montar um diário de culpa alimentar, e isso não é o que este app faz.
--
-- 3. **Marca-se hoje ou ontem, nunca antes nem depois.** Ontem existe porque
--    quem vence o dia costuma lembrar de marcar no dia seguinte. Mais para trás
--    viraria preencher a grade de memória na véspera do fim.
--
-- 4. **Quem grava é uma função, não uma policy de INSERT.** As regras precisam
--    do fuso da pessoa, da janela e da inscrição, e a resposta precisa dizer
--    qual delas barrou — como `registrar_descanso`. A tabela só tem leitura.
--
-- A marcação não entra na fila offline, pelo mesmo motivo do descanso: é uma
-- linha por dia, feita com calma, e o "ontem" cobre quem ficou sem rede.
-- =============================================================================

create type public.challenge_kind as enum ('treino', 'alimentacao');

alter table public.challenges
  add column if not exists kind public.challenge_kind not null default 'treino';

comment on column public.challenges.kind is
  'De onde sai o dia cumprido: `treino` conta treinos; `alimentacao` conta dias marcados pela pessoa.';

-- -----------------------------------------------------------------------------
-- As marcações
--
-- Sem `client_id`: a chave primária já é o dia, e marcar duas vezes o mesmo dia
-- é a mesma marcação.
-- -----------------------------------------------------------------------------
create table public.challenge_checkins (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  day          date not null,
  created_at   timestamptz not null default now(),

  primary key (challenge_id, user_id, day)
);

create index challenge_checkins_user_idx on public.challenge_checkins (user_id, day);

comment on table public.challenge_checkins is
  'Dias vencidos em desafios de marcação. Só o dia vencido existe; o que não foi marcado não é registrado.';

alter table public.challenge_checkins enable row level security;

-- cada um lê as próprias; o ranking conta as dos outros por função DEFINER
create policy "minhas marcacoes" on public.challenge_checkins for select to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Marcar e desmarcar
--
-- Devolve um código, e não exceção, para a tela dizer em português o que
-- aconteceu. `p_feito = false` desfaz: tocar sem querer não pode virar um dia
-- que não foi vencido.
-- -----------------------------------------------------------------------------
create or replace function public.marcar_dia_no_desafio(p_slug text, p_day date, p_feito boolean default true)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d    public.challenges%rowtype;
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

  if p_day < d.starts_on or p_day > d.ends_on then
    return 'fora_da_janela';
  end if;

  -- o "hoje" é o da pessoa: quem marca 23h50 em Manaus marca o dia de Manaus
  select (now() at time zone coalesce(p.timezone, 'America/Sao_Paulo'))::date
    into hoje
    from public.profiles p
   where p.id = auth.uid();

  hoje := coalesce(hoje, (now() at time zone 'America/Sao_Paulo')::date);

  if p_day > hoje or p_day < hoje - 1 then
    return 'fora_do_prazo';
  end if;

  if p_feito then
    insert into public.challenge_checkins (challenge_id, user_id, day)
    values (d.id, auth.uid(), p_day)
    on conflict do nothing;
  else
    delete from public.challenge_checkins
     where challenge_id = d.id and user_id = auth.uid() and day = p_day;
  end if;

  return 'ok';
end;
$fn$;

comment on function public.marcar_dia_no_desafio(text, date, boolean) is
  'Marca (ou desmarca) um dia vencido num desafio de alimentação. Só hoje ou ontem, no fuso da pessoa.';

revoke execute on function public.marcar_dia_no_desafio(text, date, boolean) from public, anon, authenticated;
grant execute on function public.marcar_dia_no_desafio(text, date, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Os dias cumpridos, qualquer que seja o tipo
--
-- Um lugar só responde "quais dias esta pessoa cumpriu neste desafio". Antes,
-- a mesma consulta de treino estava copiada em quatro funções; com dois tipos,
-- cópia seria o caminho para o ranking contar de um jeito e a barra de outro.
--
-- DEFINER porque o ranking pergunta pelos dias de outras pessoas. Por isso
-- mesmo não fica exposta: só as funções abaixo a chamam.
-- -----------------------------------------------------------------------------
create or replace function public.dias_cumpridos(p_challenge uuid, p_user uuid)
returns setof date
language sql
security definer
set search_path = public
stable
as $fn$
  select distinct w.workout_date
    from public.challenges c
    join public.workouts w
      on w.user_id = p_user
     and w.deleted_at is null
     and w.finished_at is not null
     and w.workout_date between c.starts_on and c.ends_on
   where c.id = p_challenge and c.kind = 'treino'
  union
  select k.day
    from public.challenges c
    join public.challenge_checkins k
      on k.challenge_id = c.id
     and k.user_id = p_user
     and k.day between c.starts_on and c.ends_on
   where c.id = p_challenge and c.kind = 'alimentacao';
$fn$;

revoke execute on function public.dias_cumpridos(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- As quatro funções de contagem passam a perguntar a `dias_cumpridos`
-- -----------------------------------------------------------------------------
create or replace function public.ranking_do_desafio(p_slug text, p_limite integer default 50)
returns table (
  user_id     uuid,
  username    text,
  full_name   text,
  avatar_path text,
  avatar_url  text,
  dias        integer,
  concluido   boolean
)
language sql
security definer
set search_path = public
stable
as $fn$
  with desafio as (
    select id from public.challenges where slug = p_slug and is_active
  )
  select
    p.id,
    p.username,
    p.full_name,
    p.avatar_path,
    p.avatar_url,
    coalesce(contagem.dias, 0)::integer,
    cp.completed_at is not null
  from public.challenge_participants cp
  join desafio d on d.id = cp.challenge_id
  join public.profiles p on p.id = cp.user_id and p.deleted_at is null
  left join lateral (
    select count(*) as dias from public.dias_cumpridos(d.id, cp.user_id)
  ) contagem on true
  order by coalesce(contagem.dias, 0) desc, cp.joined_at asc
  limit greatest(1, least(coalesce(p_limite, 50), 200));
$fn$;

-- INVOKER nas duas de "meus dias" não serve mais: `dias_cumpridos` é DEFINER e
-- recebe o usuário por argumento. Quem garante que são os MEUS dias é o
-- `auth.uid()` passado aqui dentro, e não um parâmetro que o cliente escolhe.
create or replace function public.meus_dias_no_desafio(p_slug text)
returns setof date
language sql
security definer
set search_path = public
stable
as $fn$
  select dia
    from public.challenges c,
         public.dias_cumpridos(c.id, auth.uid()) as dia
   where c.slug = p_slug and c.is_active and auth.uid() is not null
   order by 1;
$fn$;

create or replace function public.meus_dias_nos_desafios()
returns table (challenge_id uuid, dia date)
language sql
security definer
set search_path = public
stable
as $fn$
  select c.id, dia
    from public.challenges c,
         public.dias_cumpridos(c.id, auth.uid()) as dia
   where c.is_active and auth.uid() is not null
   order by 1, 2;
$fn$;

create or replace function public.concluir_desafio(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  d      public.challenges%rowtype;
  feitos integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into d from public.challenges where slug = p_slug and is_active;
  if not found then
    return false;
  end if;

  if exists (
    select 1 from public.challenge_participants
     where challenge_id = d.id and user_id = auth.uid() and completed_at is not null
  ) then
    return false;
  end if;

  select count(*) into feitos from public.dias_cumpridos(d.id, auth.uid());

  if feitos < d.goal then
    return false;
  end if;

  update public.challenge_participants
     set completed_at = now()
   where challenge_id = d.id and user_id = auth.uid();

  if not found then
    return false;
  end if;

  if d.badge_slug is not null then
    insert into public.user_badges (user_id, badge_slug, value)
    values (auth.uid(), d.badge_slug, feitos)
    on conflict (user_id, badge_slug) do nothing;
  end if;

  return true;
end;
$fn$;

-- as concessões de antes, repetidas porque `create or replace` mexe nelas
revoke execute on function public.ranking_do_desafio(text, integer) from public, anon, authenticated;
revoke execute on function public.meus_dias_no_desafio(text)         from public, anon, authenticated;
revoke execute on function public.meus_dias_nos_desafios()           from public, anon, authenticated;
revoke execute on function public.concluir_desafio(text)             from public, anon, authenticated;

grant execute on function public.ranking_do_desafio(text, integer) to authenticated;
grant execute on function public.meus_dias_no_desafio(text)         to authenticated;
grant execute on function public.meus_dias_nos_desafios()           to authenticated;
grant execute on function public.concluir_desafio(text)             to authenticated;

-- -----------------------------------------------------------------------------
-- 21 dias sem açúcar
--
-- Nasce DESLIGADO. As datas e o texto são proposta; quem publica é o admin,
-- ligando no painel depois de ler. Um desafio que aparece sozinho na tela de
-- todo mundo por causa de um deploy é decisão de comunicação tomada por engano.
--
-- 18 de 21: três dias de folga. Um aniversário no meio de três semanas não pode
-- ser o fim do desafio — é a mesma lógica dos cinco dias do mês.
-- -----------------------------------------------------------------------------
insert into public.badges (slug, name, description, metric, threshold, tier, emblem, sort_order)
values (
  'sem-acucar',
  'Sem açúcar',
  'Dezoito dias em vinte e um sem açúcar adicionado. A vontade passou a pedir licença.',
  'desafio',
  18,
  'ouro',
  'muralha',
  300
)
on conflict (slug) do nothing;

insert into public.challenges (
  slug, title, tagline, description, starts_on, ends_on, rule, goal, badge_slug,
  is_active, sort_order, kind
)
values (
  '21-dias-sem-acucar',
  '21 dias sem açúcar',
  'Um dia de cada vez. Venceu, marca.',
  E'Vinte e um dias sem açúcar adicionado. Não é dieta e não tem cardápio: é uma coisa só, por três semanas, para você ver o que muda quando ela sai.

Conta como açúcar adicionado: doce, refrigerante, suco de caixinha, açúcar no café, bolo, biscoito recheado. Não conta: fruta, leite, iogurte natural. Na dúvida, leia o rótulo — se tem açúcar entre os primeiros ingredientes, é açúcar.

Venceu o dia? Marque. Pode marcar hoje ou, se esquecer, amanhã. Escorregou? Não marque e siga. Nada zera: o dia seguinte começa limpo.

Três dias podem escapar. Dezoito dos vinte e um, e o desafio é seu.

Ninguém aqui vê o que você comeu. O ranking mostra uma coisa só: quantos dias você venceu.',
  date '2026-11-03',
  date '2026-11-23',
  'dias_no_periodo',
  18,
  'sem-acucar',
  false,
  5,
  'alimentacao'
)
on conflict (slug) do nothing;
