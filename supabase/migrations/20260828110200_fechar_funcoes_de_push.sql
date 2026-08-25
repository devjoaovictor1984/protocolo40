-- =============================================================================
-- P20X · 0035 — fechar de verdade as funções de push
--
-- A migration 0033 tentou fechá-las assim:
--
--     revoke execute on function ... from anon, authenticated;
--
-- e isso não fecha nada. O Postgres concede EXECUTE a `public` no momento em
-- que a função é criada, e `public` inclui todo mundo — revogar de `anon` e de
-- `authenticated` deixa a concessão herdada de pé.
--
-- O buraco não era pequeno: `aparelhos_inscritos()` devolve `endpoint`, `p256dh`
-- e `auth` de cada aparelho, que é exatamente o material necessário para
-- **mandar notificação em nome do P20X** para qualquer usuário. E as três são
-- SECURITY DEFINER, ou seja, rodavam com os privilégios do dono ignorando RLS.
--
-- Um teste de integração pegou isto antes de ir para produção. Ele continua lá,
-- e falha de novo se alguém recriar as funções sem repetir o `revoke`.
--
-- Nota para quem for criar função nova: `create or replace function` **restaura**
-- a concessão a `public`. Toda vez que uma destas for alterada, o revoke precisa
-- vir junto no mesmo arquivo.
-- =============================================================================

revoke execute on function public.quem_lembrar(timestamptz) from public, anon, authenticated;
revoke execute on function public.marcar_lembrete(uuid, date) from public, anon, authenticated;
revoke execute on function public.aparelhos_inscritos() from public, anon, authenticated;

-- o service role continua podendo: é ele que o cron e as ações de admin usam
grant execute on function public.quem_lembrar(timestamptz) to service_role;
grant execute on function public.marcar_lembrete(uuid, date) to service_role;
grant execute on function public.aparelhos_inscritos() to service_role;
