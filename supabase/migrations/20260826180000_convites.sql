-- =============================================================================
-- P20X · 0024 — convites
--
-- Cada pessoa tem um link com o próprio @usuário. Quem entra por ele fica
-- ligado a quem convidou, e o convite vira insígnia.
--
-- Três decisões:
--
-- 1. **O vínculo é gravado uma vez e nunca muda.** Trocar de padrinho depois
--    permitiria reatribuir convites entre contas e inflar qualquer contagem.
--    A função só escreve quando `referred_by` ainda é nulo.
--
-- 2. **Só conta quem terminou o onboarding.** Contar cadastro cru convidaria a
--    criar contas descartáveis para colecionar insígnia. O onboarding é uma
--    barreira baixa para quem é real e alta para quem está inflando número.
--
-- 3. **Ninguém convida a si mesmo.** Óbvio, e por isso mesmo verificado no
--    banco — é o primeiro atalho que alguém tenta.
-- =============================================================================

alter table public.profiles
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;

create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

comment on column public.profiles.referred_by is
  'Quem convidou esta pessoa. Gravado uma vez, no primeiro acesso, e nunca alterado.';

-- -----------------------------------------------------------------------------
-- Registrar o convite
--
-- SECURITY DEFINER porque precisa ler o perfil de outra pessoa (o de quem
-- convidou) para resolver o @usuário — e a RLS de perfil privado esconderia.
-- -----------------------------------------------------------------------------
create or replace function public.registrar_convite(p_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  padrinho uuid;
  atual    uuid;
begin
  if auth.uid() is null then
    return 'sem_sessao';
  end if;

  select referred_by into atual from public.profiles where id = auth.uid();

  -- já tem padrinho: o vínculo é definitivo
  if atual is not null then
    return 'ja_tem';
  end if;

  select id into padrinho
    from public.profiles
   where lower(username) = lower(btrim(p_username))
     and deleted_at is null;

  if padrinho is null then
    return 'nao_achou';
  end if;

  if padrinho = auth.uid() then
    return 'proprio';
  end if;

  update public.profiles set referred_by = padrinho where id = auth.uid();

  -- o padrinho pode ter acabado de ganhar uma insígnia
  perform public.conceder_conquistas(padrinho);

  return 'ok';
end;
$$;

comment on function public.registrar_convite is
  'Liga quem acabou de entrar a quem convidou. Só escreve se ainda não houver vínculo.';

-- -----------------------------------------------------------------------------
-- Quantos convites valeram
-- -----------------------------------------------------------------------------
create or replace function public.contar_convites(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.profiles
   where referred_by = p_user
     and onboarding_completed_at is not null
     and deleted_at is null;
$$;

alter type public.badge_metric add value if not exists 'convites';
