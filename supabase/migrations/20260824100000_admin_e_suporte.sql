-- =============================================================================
-- P20X · 0014 — admin master e canal de suporte
--
-- Duas coisas que andam juntas: alguém precisa ser admin para que o formulário
-- de ajuda tenha destino. O papel vive no banco, e a autorização é RLS — o
-- frontend só esconde o menu, nunca protege o dado.
-- =============================================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Admin master: lê e responde tickets, enxerga todos os usuários.';

-- SECURITY DEFINER: a policy de profiles não pode consultar profiles por RLS
-- sem entrar em recursão.
create or replace function public.eh_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = p_user), false);
$$;

comment on function public.eh_admin is 'Verdadeiro quando o usuário é admin master.';

-- -----------------------------------------------------------------------------
-- Tickets
-- -----------------------------------------------------------------------------
create type public.ticket_kind as enum ('sugestao', 'erro', 'duvida', 'outro');
create type public.ticket_status as enum ('aberto', 'em_analise', 'resolvido', 'fechado');

create table public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  kind            public.ticket_kind not null default 'outro',
  title           text not null,
  body            text not null,
  -- caminho no bucket privado `support`; o print é opcional
  screenshot_path text,
  status          public.ticket_status not null default 'aberto',
  -- o que o admin escreve de volta, visível para quem abriu
  answer          text,
  answered_at     timestamptz,
  answered_by     uuid references public.profiles (id) on delete set null,
  -- contexto técnico coletado sozinho: encurta o vai e vem
  page_url        text,
  user_agent      text,
  app_version     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint ticket_title_len  check (char_length(title) between 3 and 120),
  constraint ticket_body_len   check (char_length(body) between 5 and 4000),
  constraint ticket_answer_len check (answer is null or char_length(answer) <= 4000)
);

create index tickets_user_idx    on public.support_tickets (user_id, created_at desc);
create index tickets_status_idx  on public.support_tickets (status, created_at desc);

create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

-- quem abriu lê e escreve o seu; o admin lê e responde tudo
create policy "ticket proprio leitura" on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

create policy "ticket proprio criacao" on public.support_tickets for insert to authenticated
  with check (
    user_id = auth.uid()
    -- o autor não decide status nem resposta
    and status = 'aberto'
    and answer is null
    and answered_at is null
    and answered_by is null
  );

create policy "ticket admin atualiza" on public.support_tickets for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy "ticket admin apaga" on public.support_tickets for delete to authenticated
  using (public.eh_admin());

-- -----------------------------------------------------------------------------
-- O admin enxerga todo mundo
-- -----------------------------------------------------------------------------
create policy "profiles admin le tudo" on public.profiles for select to authenticated
  using (public.eh_admin());

create policy "profiles admin atualiza" on public.profiles for update to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

create policy "workouts admin le tudo" on public.workouts for select to authenticated
  using (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Bucket do print
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support', 'support', false, 3 * 1024 * 1024,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "support escrita propria" on storage.objects for insert to authenticated
  with check (bucket_id = 'support' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "support leitura propria ou admin" on storage.objects for select to authenticated
  using (
    bucket_id = 'support'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin())
  );

create policy "support delete proprio ou admin" on storage.objects for delete to authenticated
  using (
    bucket_id = 'support'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin())
  );
