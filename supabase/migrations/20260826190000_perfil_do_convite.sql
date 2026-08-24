-- =============================================================================
-- P20X · 0026 — o nome de quem convidou
--
-- A página de convite mostrava "Você foi convidado" sem dizer por quem, porque
-- a RLS de perfil privado esconde tudo de quem não é público. Correto para uma
-- busca; errado aqui.
--
-- Quem manda o próprio link de convite já se revelou de propósito para quem
-- recebe — e o @usuário está no próprio endereço. A divulgação é deliberada e
-- mínima: só nome e foto, só para quem já tem o link em mãos. Sequência,
-- treinos, medidas e fotos continuam sujeitos à visibilidade de sempre.
-- =============================================================================

create or replace function public.perfil_do_convite(p_username text)
returns table (
  username    text,
  full_name   text,
  avatar_path text,
  avatar_url  text,
  updated_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.username, p.full_name, p.avatar_path, p.avatar_url, p.updated_at
    from public.profiles p
   where lower(p.username) = lower(btrim(p_username))
     and p.deleted_at is null
   limit 1;
$$;

comment on function public.perfil_do_convite is
  'Nome e foto de quem convidou. Só o necessário para a página de convite se apresentar.';
