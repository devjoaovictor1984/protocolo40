-- =============================================================================
-- P20X · 0043 — meta de peso
--
-- O app já media (`body_measurements`), já calculava (`services/health.ts`) e
-- já analisava (`services/analysis.ts`) — e não tinha para onde apontar. Esta
-- tabela é o destino: um alvo, a data em que ele foi escolhido e o peso de
-- partida congelado naquele dia.
--
-- **Por que guardar `start_kg` em vez de olhar a primeira medida.**
-- O peso de partida precisa ser o de quando a meta nasceu. Se ele fosse lido do
-- histórico, uma medida antiga registrada depois (é permitido: `bm_day_key` é
-- por dia, não por ordem de chegada) mudaria o passado da meta e a barra de
-- progresso andaria sozinha.
--
-- **Por que uma tabela e não colunas em `profiles`.**
-- Meta batida é conquista, e conquista não se apaga para dar lugar à próxima.
-- `achieved_on` fecha a meta e libera o índice parcial para uma nova.
--
-- **O piso.**
-- Um app de treino que aceita "quero pesar 42 kg" de alguém com 1,75 m e traça
-- um plano para isso está ajudando a pessoa a chegar em desnutrição. O gatilho
-- recusa alvos abaixo de IMC 17 — "magreza moderada" na classificação da OMS,
-- e território de risco clínico, não de estética.
--
-- Note que o piso **não** é 18,5. Quem está com IMC 19 e quer 18,7 tem um alvo
-- legítimo, e barrar isso seria o app dando palpite sobre o corpo de alguém. A
-- faixa entre 17 e 18,5 vira aviso na tela; abaixo de 17 o banco recusa.
--
-- Sem altura no perfil não há IMC, e aí não há piso: melhor deixar passar do
-- que inventar um limite a partir de um número que não existe.
-- =============================================================================

create table public.weight_goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- peso alvo, em kg
  target_kg   numeric(5, 2) not null,
  -- peso no dia em que a meta foi criada; congelado de propósito
  start_kg    numeric(5, 2) not null,
  started_on  date not null default current_date,
  -- preenchido quando a tendência cruza o alvo; fecha a meta
  achieved_on date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint weight_goals_target_range check (target_kg between 30 and 400),
  constraint weight_goals_start_range  check (start_kg  between 30 and 400),
  constraint weight_goals_achieved_after check (achieved_on is null or achieved_on >= started_on)
);

-- Uma meta ativa por pessoa. Metas batidas e apagadas saem do índice e não
-- atrapalham a próxima.
create unique index weight_goals_ativa_key on public.weight_goals (user_id)
  where achieved_on is null and deleted_at is null;

create index weight_goals_user_idx on public.weight_goals (user_id, started_on desc);

create trigger weight_goals_set_updated_at
  before update on public.weight_goals
  for each row execute function public.set_updated_at();

comment on column public.weight_goals.start_kg is
  'Peso do dia em que a meta nasceu. Congelado: medida antiga registrada depois não muda o progresso.';

-- -----------------------------------------------------------------------------
-- Piso de segurança
--
-- Mora no banco, e não só no formulário, pelo mesmo motivo que a foto nasce
-- privada por policy: uma regra que protege alguém não pode depender de qual
-- caminho de código escreveu a linha.
-- -----------------------------------------------------------------------------
create or replace function public.checar_piso_da_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  altura smallint;
  piso   numeric(5, 2);
begin
  select height_cm into altura from public.profiles where id = new.user_id;

  -- sem altura não há IMC, e sem IMC não há piso que faça sentido
  if altura is null then
    return new;
  end if;

  -- IMC 17 · limite inferior da "magreza moderada" (OMS)
  piso := round(17 * (altura / 100.0) ^ 2, 2);

  if new.target_kg < piso then
    raise exception
      'Meta abaixo do limite seguro para % cm. O mínimo que dá para registrar aqui é %kg.',
      altura, piso
      using errcode = 'check_violation', hint = 'meta_abaixo_do_piso';
  end if;

  return new;
end;
$$;

comment on function public.checar_piso_da_meta() is
  'Recusa meta de peso abaixo de IMC 17. SECURITY DEFINER só para ler a altura do próprio perfil.';

-- O Postgres concede execute a `public` ao criar a função, e o revoke tem que
-- vir no mesmo arquivo — senão fica de pé. Ninguém chama isto direto: só o gatilho.
revoke all on function public.checar_piso_da_meta() from public, anon, authenticated;

create trigger weight_goals_piso
  before insert or update of target_kg on public.weight_goals
  for each row execute function public.checar_piso_da_meta();

-- -----------------------------------------------------------------------------
-- RLS — meta é dado de corpo: só o dono vê, e nem o admin entra aqui
-- -----------------------------------------------------------------------------
alter table public.weight_goals enable row level security;

create policy "meta propria leitura" on public.weight_goals for select to authenticated
  using (user_id = auth.uid());

create policy "meta propria escrita" on public.weight_goals for insert to authenticated
  with check (user_id = auth.uid());

create policy "meta propria atualizacao" on public.weight_goals for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "meta propria exclusao" on public.weight_goals for delete to authenticated
  using (user_id = auth.uid());
