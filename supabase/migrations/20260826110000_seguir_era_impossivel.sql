-- =============================================================================
-- P20X · 0022 — a policy de seguir era impossível de satisfazer
--
-- A policy de INSERT em `followers` exigia:
--
--   exists (select 1 from public.user_settings s
--            where s.user_id = following_id and s.allow_followers)
--
-- Só que `user_settings` tem RLS, e a policy de SELECT dela devolve apenas a
-- própria linha. Dentro da checagem, portanto, a consulta olhava as
-- configurações de OUTRA pessoa e voltava vazia — sempre. O `exists` era falso
-- em todos os casos e ninguém jamais conseguiu seguir ninguém.
--
-- O defeito passou despercebido porque nenhuma tela usava a tabela: o schema
-- da comunidade existia desde o começo, sem interface. Foi o primeiro teste de
-- seguir alguém que o encontrou.
--
-- A correção é a mesma que o resto do arquivo de RLS já usa e explica:
-- SECURITY DEFINER para quebrar a dependência entre policies. Uma policy nunca
-- deve depender do SELECT de outra tabela protegida.
-- =============================================================================

create or replace function public.aceita_seguidores(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select allow_followers from public.user_settings where user_id = p_user),
    false
  );
$$;

comment on function public.aceita_seguidores is
  'Se a pessoa aceita ser seguida. SECURITY DEFINER: a policy de followers não pode depender da RLS de user_settings.';

drop policy if exists followers_insert on public.followers;

create policy followers_insert on public.followers for insert to authenticated
  with check (
    follower_id = auth.uid()
    and following_id <> auth.uid()
    and public.aceita_seguidores(following_id)
  );
