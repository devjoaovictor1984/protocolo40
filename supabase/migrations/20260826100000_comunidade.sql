-- =============================================================================
-- P20X · 0021 — comunidade
--
-- As peças já existiam desde o começo e nenhuma tela usava: `followers`, as
-- visibilidades em `user_settings` e os helpers `can_view` e `is_follower`.
-- O que falta é o que a comunidade precisa para valer alguma coisa.
--
-- **A vitrine do antes e depois.** Foto nasce privada, e continua nascendo.
-- Expor um par é uma escolha explícita: o dono aponta duas fotos, e só essas
-- duas mudam de visibilidade. Não existe "publicar a galeria".
--
-- **Insígnias de quem você segue.** `user_badges` só era visível ao dono; a
-- policy passa a respeitar a visibilidade do perfil, como todo o resto.
-- =============================================================================

alter table public.profiles
  add column if not exists showcase_before_id uuid
    references public.progress_photos (id) on delete set null,
  add column if not exists showcase_after_id uuid
    references public.progress_photos (id) on delete set null;

comment on column public.profiles.showcase_before_id is
  'Foto "antes" que o dono escolheu expor. Nulo = nada exposto.';

-- -----------------------------------------------------------------------------
-- Conquistas de quem se pode ver
-- -----------------------------------------------------------------------------
drop policy if exists "conquista propria" on public.user_badges;

create policy "conquista visivel" on public.user_badges for select to anon, authenticated
  using (
    user_id = auth.uid()
    or public.eh_admin()
    -- as insígnias seguem a visibilidade do perfil: quem vê o perfil, vê elas
    or public.can_view_setting(user_id, 'profile')
  );

-- -----------------------------------------------------------------------------
-- Seguir sem precisar de sessão para ler contagem
--
-- O perfil público mostra quantas pessoas seguem quem. A policy de `followers`
-- só deixa cada um ver as próprias relações — de propósito, porque a lista de
-- quem alguém segue é informação pessoal. A contagem, não: ela é agregada e
-- não revela ninguém.
-- -----------------------------------------------------------------------------
create or replace function public.contar_seguidores(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.followers
   where following_id = p_user and status = 'accepted';
$$;

create or replace function public.contar_seguindo(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.followers
   where follower_id = p_user and status = 'accepted';
$$;

-- -----------------------------------------------------------------------------
-- Buscar gente
--
-- Sem esta função a busca precisaria varrer `profiles`, e a RLS de perfil
-- privado faria a consulta voltar vazia sem explicar por quê. Aqui a regra
-- fica explícita: só aparece quem tem perfil público e aceita seguidores.
-- -----------------------------------------------------------------------------
create or replace function public.buscar_pessoas(p_termo text, p_limite int default 20)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_path text,
  avatar_url text,
  seguidores int
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.full_name, p.avatar_path, p.avatar_url,
         public.contar_seguidores(p.id)
    from public.profiles p
    join public.user_settings s on s.user_id = p.id
   where p.deleted_at is null
     and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     and s.profile_visibility = 'public'
     and s.allow_followers
     and (
       p.username ilike '%' || coalesce(p_termo, '') || '%'
       or p.full_name ilike '%' || coalesce(p_termo, '') || '%'
     )
   order by public.contar_seguidores(p.id) desc, p.username
   limit least(coalesce(p_limite, 20), 50);
$$;

comment on function public.buscar_pessoas is
  'Busca pública de perfis. Só devolve quem é público e aceita seguidores.';

-- -----------------------------------------------------------------------------
-- Quem eu sigo, com o que preciso mostrar na lista
-- -----------------------------------------------------------------------------
create or replace function public.minha_rede(p_tipo text)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_path text,
  avatar_url text,
  dias_treinados int,
  sequencia int,
  desde timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with relacao as (
    select case when p_tipo = 'seguindo' then f.following_id else f.follower_id end as pessoa,
           f.created_at
      from public.followers f
     where f.status = 'accepted'
       and case when p_tipo = 'seguindo' then f.follower_id else f.following_id end = auth.uid()
  )
  select p.id, p.username, p.full_name, p.avatar_path, p.avatar_url,
         -- números só aparecem se a pessoa liberou a sequência
         case when public.can_view_setting(p.id, 'streak')
              then (select count(distinct workout_date)::int from public.workouts w
                     where w.user_id = p.id and w.deleted_at is null)
              else null end,
         case when public.can_view_setting(p.id, 'streak')
              then (select coalesce(max(t.tamanho), 0)::int from (
                     select count(*) as tamanho
                       from (
                         select workout_date as dia,
                                workout_date - (row_number() over (order by workout_date))::int as grupo
                           from (select distinct workout_date from public.workouts
                                  where user_id = p.id and deleted_at is null) d
                       ) g
                      group by grupo
                   ) t)
              else null end,
         r.created_at
    from relacao r
    join public.profiles p on p.id = r.pessoa
   where p.deleted_at is null
   order by r.created_at desc;
$$;

comment on function public.minha_rede is
  'Quem eu sigo (p_tipo = seguindo) ou quem me segue (seguidores).';
