-- =============================================================================
-- P20X · 0016 — metas de saúde e registro de água
--
-- Duas peças faltavam para a tela de saúde existir sem chutar:
--
-- 1. O sexo biológico. As equações de gasto energético (Mifflin‑St Jeor) têm um
--    termo diferente para cada um, e a diferença é de cerca de 160 kcal por dia.
--    O campo é opcional — quem não quiser informar recebe a média das duas
--    equações e um aviso na tela de que a estimativa é mais grosseira.
--
-- 2. A água do dia. Uma linha por dia por pessoa, somando mililitros. É o único
--    registro do app que cresce por toques repetidos, então a chave primária
--    composta evita duplicar a linha do dia.
-- =============================================================================

create type public.biological_sex as enum ('feminino', 'masculino', 'nao_informado');

alter table public.profiles
  add column if not exists biological_sex public.biological_sex not null default 'nao_informado';

comment on column public.profiles.biological_sex is
  'Usado apenas nas equações de gasto energético. Opcional.';

-- -----------------------------------------------------------------------------
-- Água
-- -----------------------------------------------------------------------------
create table public.water_logs (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- dia local do usuário, como em workouts.workout_date
  day        date not null,
  ml         integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, day),

  -- 20 litros é impossível; o teto existe para barrar erro de digitação
  constraint water_range check (ml >= 0 and ml <= 20000)
);

create index water_user_day_idx on public.water_logs (user_id, day desc);

create trigger water_logs_updated_at
  before update on public.water_logs
  for each row execute function public.set_updated_at();

alter table public.water_logs enable row level security;

create policy "agua propria leitura" on public.water_logs for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

create policy "agua propria escrita" on public.water_logs for insert to authenticated
  with check (user_id = auth.uid());

create policy "agua propria atualizacao" on public.water_logs for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "agua propria exclusao" on public.water_logs for delete to authenticated
  using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Somar água sem corrida entre dois toques
--
-- Dois toques quase simultâneos com `select` + `update` na aplicação perderiam
-- um dos dois. O upsert com soma no próprio banco resolve, e devolve o total já
-- atualizado para a tela mostrar.
-- -----------------------------------------------------------------------------
create or replace function public.somar_agua(p_day date, p_ml integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  total integer;
begin
  insert into public.water_logs (user_id, day, ml)
  values (auth.uid(), p_day, greatest(0, least(20000, p_ml)))
  on conflict (user_id, day)
  do update set ml = greatest(0, least(20000, public.water_logs.ml + p_ml))
  returning ml into total;

  return total;
end;
$$;

comment on function public.somar_agua is
  'Soma (ou subtrai) mililitros no dia, sem corrida entre toques. SECURITY INVOKER: a RLS continua valendo.';
