-- =============================================================================
-- P20X · 0033 — notificações push
--
-- Uma notificação é a única coisa deste app que aparece sem ser chamada. Isso
-- muda tudo: o que aqui for descuidado vira incômodo no bolso de alguém às
-- onze da noite, e a pessoa desinstala.
--
-- Cinco decisões:
--
-- 1. **A inscrição é por aparelho, não por pessoa.** Quem usa celular e tablet
--    tem duas. A chave é o `endpoint`, que é o que o navegador entrega e o que
--    o serviço de push reconhece.
--
-- 2. **Inscrição morta é apagada, não marcada.** Quando o serviço responde 404
--    ou 410, aquele aparelho não existe mais — guardar a linha só faria a
--    próxima campanha tentar de novo e demorar mais.
--
-- 3. **Campanha é registro, não só envio.** Fica gravado o que foi mandado,
--    para quem, quando e por quem. Sem isso não há como responder "por que
--    recebi isso?", e é a pergunta que sempre vem.
--
-- 4. **Um lembrete por dia, no máximo.** `last_reminded_on` é a trava. O cron
--    roda de hora em hora para acertar o fuso de cada um, e sem a trava quem
--    mudasse de fuso receberia duas vezes.
--
-- 5. **Quem envia campanha é admin, e só pelo servidor.** Não existe policy de
--    INSERT em `notification_campaigns` para o cliente comum.
-- =============================================================================

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- o endereço que o navegador dá; é ele que identifica o aparelho
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  -- só para a administração saber de onde vem, nunca para decidir conteúdo
  user_agent text,
  created_at timestamptz not null default now(),
  -- quando o serviço de push respondeu pela última vez sem erro
  last_ok_at timestamptz,

  constraint push_endpoint_len check (char_length(endpoint) between 10 and 2000)
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

comment on table public.push_subscriptions is
  'Um aparelho inscrito para receber push. Inscrição morta é apagada, não marcada.';

-- -----------------------------------------------------------------------------
-- O que já foi disparado
-- -----------------------------------------------------------------------------
create type public.campaign_status as enum ('rascunho', 'enviando', 'enviada', 'falhou');

create table public.notification_campaigns (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  -- para onde a notificação leva ao ser tocada
  url          text not null default '/hoje',
  status       public.campaign_status not null default 'rascunho',
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  -- quantos aparelhos aceitaram e quantos recusaram
  entregues    integer not null default 0,
  falhas       integer not null default 0,

  constraint campanha_titulo_len check (char_length(title) between 3 and 60),
  constraint campanha_corpo_len  check (char_length(body) between 3 and 180),
  constraint campanha_url_forma  check (url ~ '^/')
);

create index notification_campaigns_recentes_idx
  on public.notification_campaigns (created_at desc);

comment on column public.notification_campaigns.body is
  'Até 180 caracteres: Android corta perto disso e iOS mostra menos ainda.';

-- -----------------------------------------------------------------------------
-- A trava do lembrete diário
-- -----------------------------------------------------------------------------
alter table public.user_settings
  add column if not exists push_enabled boolean not null default false,
  add column if not exists last_reminded_on date;

comment on column public.user_settings.push_enabled is
  'A pessoa autorizou lembretes. Separado da permissão do navegador: revogar aqui é mais fácil.';

comment on column public.user_settings.last_reminded_on is
  'Trava de um lembrete por dia. O cron roda de hora em hora para acertar cada fuso.';

-- -----------------------------------------------------------------------------
-- Quem vê o quê
-- -----------------------------------------------------------------------------
alter table public.push_subscriptions enable row level security;
alter table public.notification_campaigns enable row level security;

create policy "inscricao propria" on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

create policy "inscrevo eu mesmo" on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

create policy "desinscrevo eu mesmo" on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid() or public.eh_admin());

create policy "atualizo a minha" on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- o histórico de campanhas é do admin; ninguém mais precisa dele
create policy "campanha admin" on public.notification_campaigns for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Quem deve receber o lembrete agora
--
-- SECURITY DEFINER porque roda a partir do cron, sem sessão de ninguém, e
-- precisa cruzar `user_settings` com `workouts` e `rest_days` de todo mundo.
--
-- A regra do que é "agora": a hora local da pessoa bateu com a que ela
-- escolheu. O fuso mora no perfil e a conta é feita no banco, com
-- `at time zone` — comparar no TypeScript exigiria trazer todo mundo para a
-- memória do servidor para descartar 95%.
--
-- Ninguém recebe se já treinou, se registrou descanso, ou se já foi lembrado
-- hoje. Cobrar quem já fez é o jeito mais rápido de virar notificação ignorada.
-- -----------------------------------------------------------------------------
create or replace function public.quem_lembrar(p_agora timestamptz default now())
returns table (
  user_id  uuid,
  endpoint text,
  p256dh   text,
  auth     text,
  dia      date
)
language sql
security definer
set search_path = public
stable
as $fn$
  with alvo as (
    select
      p.id,
      (p_agora at time zone p.timezone)::date as dia_local,
      extract(hour from (p_agora at time zone p.timezone))::int as hora_local,
      extract(hour from s.reminder_time)::int as hora_escolhida
    from public.profiles p
    join public.user_settings s on s.user_id = p.id
    where p.deleted_at is null
      and s.push_enabled
      and s.reminder_time is not null
  )
  select
    a.id,
    ps.endpoint,
    ps.p256dh,
    ps.auth,
    a.dia_local
  from alvo a
  join public.user_settings s on s.user_id = a.id
  join public.push_subscriptions ps on ps.user_id = a.id
  where a.hora_local = a.hora_escolhida
    -- um por dia, mesmo que o cron rode duas vezes ou a pessoa mude de fuso
    and (s.last_reminded_on is null or s.last_reminded_on < a.dia_local)
    -- quem já treinou não precisa ser lembrado de treinar
    and not exists (
      select 1 from public.workouts w
       where w.user_id = a.id
         and w.workout_date = a.dia_local
         and w.deleted_at is null
         and w.finished_at is not null
    )
    -- nem quem escolheu descansar hoje
    and not exists (
      select 1 from public.rest_days r
       where r.user_id = a.id and r.day = a.dia_local
    );
$fn$;

comment on function public.quem_lembrar(timestamptz) is
  'Aparelhos que devem receber o lembrete agora. Não inclui quem já treinou, descansou ou já foi lembrado hoje.';

-- -----------------------------------------------------------------------------
-- Marca que o lembrete saiu
-- -----------------------------------------------------------------------------
create or replace function public.marcar_lembrete(p_user uuid, p_dia date)
returns void
language sql
security definer
set search_path = public
as $fn$
  update public.user_settings set last_reminded_on = p_dia where user_id = p_user;
$fn$;

-- -----------------------------------------------------------------------------
-- Todos os aparelhos inscritos, para campanha
-- -----------------------------------------------------------------------------
create or replace function public.aparelhos_inscritos()
returns table (user_id uuid, endpoint text, p256dh text, auth text)
language sql
security definer
set search_path = public
stable
as $fn$
  select ps.user_id, ps.endpoint, ps.p256dh, ps.auth
    from public.push_subscriptions ps
    join public.user_settings s on s.user_id = ps.user_id
    join public.profiles p on p.id = ps.user_id and p.deleted_at is null
   where s.push_enabled;
$fn$;

-- as três só rodam pelo servidor, com service role; nenhum grant para o cliente
revoke execute on function public.quem_lembrar(timestamptz) from anon, authenticated;
revoke execute on function public.marcar_lembrete(uuid, date) from anon, authenticated;
revoke execute on function public.aparelhos_inscritos() from anon, authenticated;
