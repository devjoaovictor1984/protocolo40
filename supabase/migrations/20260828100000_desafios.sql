-- =============================================================================
-- P20X · 0030 — desafios
--
-- Um desafio é um acordo com data marcada: "20 minutos, todos os dias, durante
-- setembro". Não é um treino nem uma insígnia — é o motivo de alguém começar
-- numa segunda-feira em vez de "semana que vem".
--
-- Quatro decisões:
--
-- 1. **Participar é um ato deliberado.** Ninguém entra num desafio sem clicar.
--    Contar todo mundo automaticamente transformaria a tela num relatório de
--    quem está falhando, que é o oposto do que ela serve.
--
-- 2. **O progresso não é gravado, é contado.** Não existe coluna "dias feitos":
--    o número sai dos treinos que já estão no banco. Assim ele nunca fica
--    errado — apagar um treino corrige o desafio sozinho, e não há caminho para
--    alguém escrever um número que não aconteceu.
--
-- 3. **O ranking mostra constância, nunca corpo.** Dias mantidos e @usuário. A
--    política do app é que peso, medida e foto são privados; um ranking é
--    exatamente o lugar onde essa regra seria quebrada por descuido.
--
-- 4. **Entrar no desafio é entrar no ranking.** Sem exceção por perfil privado:
--    seria uma lista com buracos inexplicáveis. A tela diz isso antes do
--    clique, e sair do desafio tira a pessoa da lista na hora.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- O que conta como dia cumprido
--
-- `dias_no_periodo` é o formato do desafio de setembro: some os dias treinados
-- dentro da janela. `dias_seguidos` cobra sequência sem falha. `minutos` é para
-- quem quiser propor volume em vez de frequência.
-- -----------------------------------------------------------------------------
create type public.challenge_rule as enum ('dias_no_periodo', 'dias_seguidos', 'minutos_no_periodo');

create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  -- a frase curta que aparece embaixo do nome
  tagline     text,
  -- a mística: por que este desafio existe e o que ele cobra
  description text not null,
  starts_on   date not null,
  ends_on     date not null,
  rule        public.challenge_rule not null default 'dias_no_periodo',
  -- quantos dias (ou minutos) para concluir
  goal        integer not null,
  -- insígnia entregue a quem terminar; nula se o desafio não dá emblema
  badge_slug  text references public.badges (slug) on delete set null,
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint challenge_slug_forma check (slug ~ '^[a-z0-9-]{3,40}$'),
  constraint challenge_titulo_len check (char_length(title) between 3 and 60),
  constraint challenge_janela     check (ends_on >= starts_on),
  constraint challenge_meta       check (goal > 0)
);

create index challenges_ativos_idx on public.challenges (is_active, starts_on desc);

comment on table public.challenges is
  'Desafios com data marcada. O progresso não mora aqui: é contado a partir dos treinos.';

create table public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  -- gravado pela função de conclusão; serve para não reentregar a insígnia
  completed_at timestamptz,

  primary key (challenge_id, user_id)
);

create index challenge_participants_user_idx on public.challenge_participants (user_id);

-- -----------------------------------------------------------------------------
-- Quem vê o quê
-- -----------------------------------------------------------------------------
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;

-- o catálogo é público: um desafio que ninguém vê não convida ninguém
create policy "desafio leitura" on public.challenges for select to anon, authenticated
  using (is_active or public.eh_admin());

create policy "desafio admin escreve" on public.challenges for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- a lista de participantes é visível: é ela que vira o ranking
create policy "participacao leitura" on public.challenge_participants for select to authenticated
  using (true);

create policy "entro eu mesmo" on public.challenge_participants for insert to authenticated
  with check (user_id = auth.uid());

create policy "saio eu mesmo" on public.challenge_participants for delete to authenticated
  using (user_id = auth.uid() or public.eh_admin());

-- ninguém marca a própria conclusão: quem marca é a função abaixo
create policy "conclusao admin" on public.challenge_participants for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- -----------------------------------------------------------------------------
-- O ranking
--
-- SECURITY DEFINER porque precisa contar treinos de outras pessoas, e a RLS de
-- `workouts` — corretamente — esconde isso. O que sai daqui é só o que a tela
-- mostra: @usuário, nome, foto e dias. Nenhuma medida, nenhum peso, nenhuma
-- data de treino individual.
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
    select id, starts_on, ends_on from public.challenges where slug = p_slug and is_active
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
    select count(distinct w.workout_date) as dias
      from public.workouts w
     where w.user_id = cp.user_id
       and w.deleted_at is null
       and w.finished_at is not null
       and w.workout_date between d.starts_on and d.ends_on
  ) contagem on true
  order by coalesce(contagem.dias, 0) desc, cp.joined_at asc
  limit greatest(1, least(coalesce(p_limite, 50), 200));
$fn$;

comment on function public.ranking_do_desafio(text, integer) is
  'Ranking de um desafio: só constância e identidade pública. Nunca peso, medida ou foto.';

-- -----------------------------------------------------------------------------
-- Os dias que EU cumpri, para desenhar a barra e a grade do mês
-- -----------------------------------------------------------------------------
create or replace function public.meus_dias_no_desafio(p_slug text)
returns setof date
language sql
security invoker
set search_path = public
stable
as $fn$
  select distinct w.workout_date
    from public.workouts w
    join public.challenges c on c.slug = p_slug and c.is_active
   where w.user_id = auth.uid()
     and w.deleted_at is null
     and w.finished_at is not null
     and w.workout_date between c.starts_on and c.ends_on
   order by 1;
$fn$;

-- -----------------------------------------------------------------------------
-- Quantos estão participando de cada desafio
-- -----------------------------------------------------------------------------
create or replace function public.participantes_por_desafio()
returns table (challenge_id uuid, total integer)
language sql
security definer
set search_path = public
stable
as $fn$
  select cp.challenge_id, count(*)::integer
    from public.challenge_participants cp
   group by cp.challenge_id;
$fn$;

grant execute on function public.ranking_do_desafio(text, integer) to authenticated;
grant execute on function public.meus_dias_no_desafio(text) to authenticated;
grant execute on function public.participantes_por_desafio() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Conclusão: a insígnia cai quando a meta é atingida
--
-- Chamada pelo app ao abrir o desafio. Escreve uma vez só — `completed_at` é a
-- trava, e a insígnia usa `on conflict do nothing`, como as outras.
-- -----------------------------------------------------------------------------
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

  -- já concluiu: nada a fazer
  if exists (
    select 1 from public.challenge_participants
     where challenge_id = d.id and user_id = auth.uid() and completed_at is not null
  ) then
    return false;
  end if;

  select count(distinct w.workout_date) into feitos
    from public.workouts w
   where w.user_id = auth.uid()
     and w.deleted_at is null
     and w.finished_at is not null
     and w.workout_date between d.starts_on and d.ends_on;

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

grant execute on function public.concluir_desafio(text) to authenticated;

create trigger challenges_set_updated_at
  before update on public.challenges
  for each row execute function public.set_updated_at();
