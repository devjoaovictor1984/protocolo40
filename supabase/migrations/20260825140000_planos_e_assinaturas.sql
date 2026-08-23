-- =============================================================================
-- P20X · 0018 — planos, assinaturas e registro de auditoria
--
-- O núcleo do produto é livre para sempre: treinar, registrar, histórico,
-- fotos, calendário e conquistas. O plano pago libera o que exige trabalho
-- contínuo de manutenção — a Análise, a tela de Saúde e o vídeo de evolução.
--
-- Três decisões que ficam explícitas no schema:
--
-- 1. **Quem concede acesso é o banco.** `tem_acesso()` é SECURITY DEFINER e é
--    a única resposta que vale. O frontend esconde botão; nunca autoriza.
-- 2. **A assinatura nunca é escrita pelo cliente.** Não existe policy de
--    INSERT ou UPDATE para `authenticated`: quem grava é o webhook do Stripe,
--    com service role, ou o admin por uma função auditada.
-- 3. **Ação de admin fica registrada.** Conceder plano de graça, remover
--    acesso e apagar conta são coisas que alguém pode precisar explicar
--    depois.
-- =============================================================================

create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'
);

create type public.billing_interval as enum ('mes', 'ano', 'vitalicio');

-- -----------------------------------------------------------------------------
-- Catálogo de planos
-- -----------------------------------------------------------------------------
create table public.plans (
  slug            text primary key,
  name            text not null,
  tagline         text,
  description     text,
  price_cents     integer not null default 0,
  currency        text not null default 'BRL',
  interval        public.billing_interval not null default 'mes',
  -- o preço no Stripe; nulo enquanto a cobrança não estiver ligada
  stripe_price_id text,
  /**
   * O que o plano libera.
   *
   * Lista de chaves de recurso, e não colunas booleanas: acrescentar um
   * recurso novo passa a ser uma linha de dado, não uma migration.
   */
  features        text[] not null default '{}',
  is_active       boolean not null default true,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint plan_name_len   check (char_length(name) between 2 and 60),
  constraint plan_price_pos  check (price_cents >= 0)
);

create trigger plans_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Assinaturas
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  user_id                uuid primary key references public.profiles (id) on delete cascade,
  plan_slug              text not null references public.plans (slug) on delete restrict,
  status                 public.subscription_status not null default 'active',
  -- até quando o acesso vale; nulo em plano vitalício ou concedido sem prazo
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  /**
   * Concedido à mão pelo admin.
   *
   * Existe para cortesia, teste e resolução de problema de cobrança — e para
   * que o webhook do Stripe não sobrescreva, sem querer, um acesso que foi
   * dado de propósito.
   */
  granted_by             uuid references public.profiles (id) on delete set null,
  granted_reason         text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index subscriptions_status_idx on public.subscriptions (status, current_period_end);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Auditoria das ações administrativas
-- -----------------------------------------------------------------------------
create table public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,
  target_id   uuid,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_created_idx on public.admin_audit_log (created_at desc);
create index audit_actor_idx   on public.admin_audit_log (actor_id, created_at desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.admin_audit_log enable row level security;

-- o catálogo é público: a página de planos precisa abrir sem sessão
create policy "planos leitura" on public.plans
  for select to anon, authenticated using (is_active or public.eh_admin());

create policy "planos admin escreve" on public.plans
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- a pessoa lê a própria assinatura; ninguém escreve pelo cliente
create policy "assinatura propria leitura" on public.subscriptions
  for select to authenticated using (user_id = auth.uid() or public.eh_admin());

create policy "auditoria admin leitura" on public.admin_audit_log
  for select to authenticated using (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Quem tem acesso a quê
-- -----------------------------------------------------------------------------
create or replace function public.tem_acesso(p_recurso text, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    -- admin enxerga tudo, senão não conseguiria dar suporte
    (select is_admin from public.profiles where id = p_user),
    false
  )
  or exists (
    select 1
      from public.subscriptions s
      join public.plans p on p.slug = s.plan_slug
     where s.user_id = p_user
       and s.status in ('active', 'trialing')
       and (s.current_period_end is null or s.current_period_end > now())
       and p_recurso = any (p.features)
  );
$$;

comment on function public.tem_acesso is
  'Verdadeiro quando o usuário pode usar o recurso. Única fonte de verdade da liberação.';

-- -----------------------------------------------------------------------------
-- Conceder e remover à mão, com registro
-- -----------------------------------------------------------------------------
create or replace function public.conceder_plano(
  p_user uuid,
  p_plan text,
  p_ate timestamptz,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'Somente admin pode conceder plano.';
  end if;

  insert into public.subscriptions (
    user_id, plan_slug, status, current_period_end, granted_by, granted_reason
  )
  values (p_user, p_plan, 'active', p_ate, auth.uid(), p_motivo)
  on conflict (user_id) do update
    set plan_slug = excluded.plan_slug,
        status = 'active',
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = false,
        granted_by = excluded.granted_by,
        granted_reason = excluded.granted_reason;

  insert into public.admin_audit_log (actor_id, action, target_id, detail)
  values (
    auth.uid(),
    'plano_concedido',
    p_user,
    jsonb_build_object('plano', p_plan, 'ate', p_ate, 'motivo', p_motivo)
  );
end;
$$;

create or replace function public.revogar_plano(p_user uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_admin() then
    raise exception 'Somente admin pode revogar plano.';
  end if;

  update public.subscriptions
     set status = 'canceled', cancel_at_period_end = false
   where user_id = p_user;

  insert into public.admin_audit_log (actor_id, action, target_id, detail)
  values (auth.uid(), 'plano_revogado', p_user, jsonb_build_object('motivo', p_motivo));
end;
$$;

-- -----------------------------------------------------------------------------
-- Os planos iniciais
--
-- Os preços ficam aqui como ponto de partida e são editáveis pelo admin sem
-- deploy. `stripe_price_id` entra quando a cobrança for ligada.
-- -----------------------------------------------------------------------------
insert into public.plans (slug, name, tagline, description, price_cents, interval, features, sort_order) values
  (
    'livre',
    'Livre',
    'Para sempre, sem cartão',
    'Treinar, registrar, histórico, calendário, fotos de evolução, recordes e conquistas. Tudo o que o P20X promete no slogan continua aberto.',
    0,
    'mes',
    '{}',
    10
  ),
  (
    'mensal',
    'P20X Completo',
    'Análise e saúde, todo mês',
    'Tudo do Livre, mais a Análise que diz o que mudar em cada exercício, a tela de Saúde com calorias, proteína e água, e o vídeo de evolução quando ficar pronto.',
    1990,
    'mes',
    '{analise,saude,video}',
    20
  ),
  (
    'anual',
    'P20X Completo anual',
    'Dois meses de desconto',
    'O mesmo do mensal, pago uma vez por ano. Sai por menos de 17 reais por mês.',
    19900,
    'ano',
    '{analise,saude,video}',
    30
  )
on conflict (slug) do nothing;
