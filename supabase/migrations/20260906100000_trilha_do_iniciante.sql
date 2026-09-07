-- =============================================================================
-- P20X · 0046 — a Trilha do Iniciante em Casa
--
-- O app tinha quinze treinos e nenhuma ordem entre eles. Quem chega sem nunca
-- ter treinado abre `/treinos`, vê quinze cartões igualmente plausíveis e faz o
-- que todo mundo faz diante de quinze opções: escolhe o primeiro, repete até
-- enjoar, ou fecha o app. A biblioteca responde "o que eu faço hoje?"; ela não
-- responde "o que eu faço nas próximas quatro semanas?".
--
-- A trilha é essa segunda resposta: 28 sessões numeradas, na ordem em que um
-- personal colocaria, com uma frase por sessão explicando por que ela existe.
--
-- Cinco decisões:
--
-- 1. **A trilha anda com dias treinados, não com o calendário.** Quem entra
--    hoje e treina na sexta está na sessão 2 na sexta, não na sessão 5. Um
--    programa que pune quem faltou na terça é um programa que quem faltou na
--    terça abandona — e essa é exatamente a pessoa para quem ele foi feito.
--
-- 2. **O progresso é contado, não gravado** — como nos desafios. Não existe
--    coluna "sessões feitas": o número sai de `workouts`. Apagar um treino
--    corrige a trilha sozinho, e não há caminho para escrever um progresso que
--    não aconteceu.
--
-- 3. **Qualquer treino conta.** Se a sessão do dia é "Ritmo 2" e a pessoa fez
--    um treino livre, a trilha avança. A ordem é sugestão de um profissional,
--    não portaria: o que a trilha cobra é o dia, e o dia foi cumprido. Isto
--    também é o que faz a contagem funcionar offline, sem caminho de escrita
--    novo e sem discordar da sequência na mesma tela.
--
-- 4. **A trilha é privada.** Desafio tem ranking porque é competição declarada;
--    trilha é aula particular. Ninguém precisa saber que outra pessoa está na
--    sessão 3 — e "em que sessão você está" é, na prática, "há quanto tempo
--    você treina", que é dado de corpo por outro nome.
--
-- 5. **Nenhum dia é de descanso obrigatório, e nenhum é pesado.** O método é
--    "todos os dias"; o que varia é a intensidade. Por isso a semana tem um dia
--    de mobilidade e um de recuperação ativa em vez de dois dias em branco —
--    quem para dois dias por semana no primeiro mês costuma parar de vez.
--
-- E uma escolha de conteúdo que sustenta o resto: **o mesmo circuito de
-- referência volta nos dias 6, 13, 20 e 28**. Ele é a única medida honesta de
-- progresso que um iniciante tem em quatro semanas — mesmo circuito, mesmo
-- tempo, número de rounds diferente. Peso não serve para isso (oscila com água
-- e sal, e a trilha não fala de corpo), e "sensação" não se compara.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Treino de programa não aparece na biblioteca
--
-- A trilha traz onze circuitos novos. Jogados em `/treinos`, eles dobrariam a
-- lista com coisas que só fazem sentido dentro de uma sequência — "Fundação A+"
-- solto, sem o "A" antes, não é um treino, é um pedaço.
--
-- A coluna é do template, e não uma tag, porque isto não é assunto: é se ele
-- tem vida própria fora do programa. O catálogo offline continua trazendo todos
-- (o cronômetro precisa abrir a sessão sem rede); quem filtra é a tela da lista.
-- -----------------------------------------------------------------------------
alter table public.workout_templates
  add column if not exists program_only boolean not null default false;

comment on column public.workout_templates.program_only is
  'Treino que só existe dentro de uma trilha. Fica fora da lista de /treinos.';

-- -----------------------------------------------------------------------------
-- Os degraus que faltavam na biblioteca de exercícios
--
-- A biblioteca começava na flexão de joelhos e no agachamento livre. Para quem
-- nunca treinou, os dois já são o segundo degrau: falta o primeiro. Sem ele, a
-- sessão 1 vira "faça o que você ainda não consegue", e o dia 1 é justamente o
-- dia em que ninguém volta depois de falhar.
--
-- Nenhum deles pede equipamento. A cadeira do agachamento é móvel de casa, não
-- material de treino — por isso `equipment` fica vazio e a cadeira é explicada
-- na instrução, onde ela é informação e não barreira.
-- -----------------------------------------------------------------------------
insert into public.exercises (slug, name, category, modality, equipment, instructions) values
  ('flexao-parede', 'Flexão na parede', 'peito', 'reps', '{}',
   'Mãos na parede na altura do peito, um pouco mais largas que os ombros, pés afastados dela. Desça o peito até perto da parede e empurre. Quanto mais longe os pés, mais pesa.'),
  ('agachamento-cadeira', 'Agachamento na cadeira', 'pernas', 'reps', '{}',
   'De costas para uma cadeira, desça até encostar e levante sem usar as mãos. A cadeira ensina a profundidade certa e segura a descida — é o agachamento antes do agachamento.'),
  ('prancha-joelhos', 'Prancha nos joelhos', 'abdomen', 'time', '{}',
   'Antebraços no chão, joelhos apoiados, quadril na linha do tronco. Se a lombar afundar, o tempo acabou — vale menos tempo bem feito.'),
  ('bom-dia', 'Bom dia', 'pernas', 'reps', '{}',
   'De pé, joelhos macios, mãos na nuca. Empurre o quadril para trás mantendo as costas retas e volte apertando o glúteo. É o movimento que protege a lombar em todo o resto.')
on conflict (slug) where owner_id is null do nothing;

-- -----------------------------------------------------------------------------
-- Os onze circuitos da trilha
--
-- Todos seguem o método do app: repetir o circuito no seu ritmo pelo tempo, e
-- contar rounds. Mobilidade e recuperação são as duas exceções de método —
-- `livre`, porque contar voltas de alongamento não mede nada — e as duas
-- exceções de duração, que a decisão de produto já permite: 20 minutos é
-- referência, não regra.
-- -----------------------------------------------------------------------------
insert into public.workout_templates
  (id, owner_id, title, subtitle, description, level, place, tags, estimated_seconds, method, program_only, sort_order) values

  ('c0000001-0000-4000-8000-000000000001', null, 'Fundação A',
   'O primeiro contato com força',
   'Repita o circuito no seu ritmo durante 20 minutos. Descanse entre as voltas sempre que precisar — no dia 1 o objetivo é terminar, não somar rounds.',
   'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 1200, 'amrap', true, 1),

  ('c0000001-0000-4000-8000-000000000002', null, 'Fundação B',
   'Quadril, glúteo e costas',
   'Repita o circuito no seu ritmo durante 20 minutos. Este é o lado do corpo que ninguém vê e que segura a postura quando o resto cansa.',
   'iniciante', 'casa', '{inferiores,sem_equipamento,trilha}', 1200, 'amrap', true, 2),

  ('c0000001-0000-4000-8000-000000000003', null, 'Ritmo 1',
   'Cardio sem impacto',
   'Repita o circuito durante 20 minutos. Nenhum salto: tudo aqui pode ser feito num apartamento, de madrugada, sem incomodar ninguém.',
   'iniciante', 'casa', '{cardio,sem_equipamento,trilha}', 1200, 'amrap', true, 3),

  ('c0000001-0000-4000-8000-000000000004', null, 'Centro 1',
   'Abdômen começa pela lombar',
   'Repita o circuito durante 20 minutos. Se a lombar sair do chão, diminua a amplitude — não é preguiça, é a execução certa.',
   'iniciante', 'casa', '{core,sem_equipamento,trilha}', 1200, 'amrap', true, 4),

  ('c0000001-0000-4000-8000-000000000005', null, 'Fundação A+',
   'A flexão sai da parede',
   'Repita o circuito durante 20 minutos. A flexão desce para o chão com os joelhos apoiados: se der cinco por volta, são cinco.',
   'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 1200, 'amrap', true, 5),

  ('c0000001-0000-4000-8000-000000000006', null, 'Fundação B+',
   'Mais volume na mesma base',
   'Repita o circuito durante 20 minutos. O afundo entra agora — uma perna de cada vez, sem pressa, joelho de trás quase encostando.',
   'iniciante', 'casa', '{inferiores,sem_equipamento,trilha}', 1200, 'amrap', true, 6),

  ('c0000001-0000-4000-8000-000000000007', null, 'Ritmo 2',
   'Entra o impacto',
   'Repita o circuito durante 20 minutos. Aterrisse com o joelho macio, nunca travado. Se a respiração fechar, ande no lugar até voltar.',
   'iniciante', 'casa', '{cardio,sem_equipamento,trilha}', 1200, 'amrap', true, 7),

  ('c0000001-0000-4000-8000-000000000008', null, 'Centro 2',
   'A prancha sai dos joelhos',
   'Repita o circuito durante 20 minutos. Vinte segundos de prancha com o quadril na linha valem mais que quarenta com ele caído.',
   'iniciante', 'casa', '{core,sem_equipamento,trilha}', 1200, 'amrap', true, 8),

  ('c0000001-0000-4000-8000-000000000009', null, 'Referência 5·10·15',
   'A medida que se repete quatro vezes',
   'Repita o circuito durante 20 minutos e anote os rounds. Este é o mesmo circuito dos dias 6, 13, 20 e 28: a diferença entre esses quatro números é o seu progresso, medido do jeito honesto.',
   'iniciante', 'casa', '{corpo_inteiro,sem_equipamento,trilha}', 1200, 'amrap', true, 9),

  ('c0000001-0000-4000-8000-00000000000a', null, 'Mobilidade guiada',
   'Quinze minutos sem esforço',
   'Passe por cada movimento sem pressa e sem contar voltas. Este dia não é folga: é o que permite treinar amanhã.',
   'iniciante', 'casa', '{recuperacao_ativa,sem_equipamento,trilha}', 900, 'livre', true, 10),

  ('c0000001-0000-4000-8000-00000000000b', null, 'Recuperação ativa',
   'Corpo em movimento, sem carga',
   'Caminhe, alongue e respire. Vinte minutos assim fazem mais pela semana que vem do que um dia inteiro parado.',
   'iniciante', 'casa', '{recuperacao_ativa,sem_equipamento,trilha}', 1200, 'livre', true, 11)

on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  level = excluded.level,
  place = excluded.place,
  tags = excluded.tags,
  estimated_seconds = excluded.estimated_seconds,
  method = excluded.method,
  program_only = excluded.program_only,
  sort_order = excluded.sort_order,
  is_active = true,
  deleted_at = null;

delete from public.workout_template_exercises
 where template_id in (
   select id from public.workout_templates
    where owner_id is null and id::text like 'c0000001-%'
 );

insert into public.workout_template_exercises
  (template_id, exercise_id, sets, repetitions, duration_seconds, distance_meters, order_index)
select v.tpl::uuid, e.id, 1, v.reps, v.dur, v.dist, v.ord
  from (values
    -- Fundação A
    ('c0000001-0000-4000-8000-000000000001', 'flexao-parede',          8, null::int, null::int, 1),
    ('c0000001-0000-4000-8000-000000000001', 'agachamento-cadeira',   10, null,      null,      2),
    ('c0000001-0000-4000-8000-000000000001', 'prancha-joelhos',     null,   20,      null,      3),
    ('c0000001-0000-4000-8000-000000000001', 'marcha-estacionaria', null,   45,      null,      4),
    -- Fundação B
    ('c0000001-0000-4000-8000-000000000002', 'bom-dia',               12, null,      null,      1),
    ('c0000001-0000-4000-8000-000000000002', 'ponte-gluteo',          12, null,      null,      2),
    ('c0000001-0000-4000-8000-000000000002', 'superman',              10, null,      null,      3),
    ('c0000001-0000-4000-8000-000000000002', 'marcha-estacionaria', null,   45,      null,      4),
    -- Ritmo 1
    ('c0000001-0000-4000-8000-000000000003', 'marcha-estacionaria', null,   60,      null,      1),
    ('c0000001-0000-4000-8000-000000000003', 'polichinelo',           15, null,      null,      2),
    ('c0000001-0000-4000-8000-000000000003', 'agachamento-cadeira',   10, null,      null,      3),
    ('c0000001-0000-4000-8000-000000000003', 'gato-camelo',            8, null,      null,      4),
    -- Centro 1
    ('c0000001-0000-4000-8000-000000000004', 'dead-bug',              10, null,      null,      1),
    ('c0000001-0000-4000-8000-000000000004', 'abdominal-supra',       10, null,      null,      2),
    ('c0000001-0000-4000-8000-000000000004', 'prancha-joelhos',     null,   20,      null,      3),
    ('c0000001-0000-4000-8000-000000000004', 'ponte-gluteo',          12, null,      null,      4),
    -- Fundação A+
    ('c0000001-0000-4000-8000-000000000005', 'flexao-apoiada',         6, null,      null,      1),
    ('c0000001-0000-4000-8000-000000000005', 'agachamento',           12, null,      null,      2),
    ('c0000001-0000-4000-8000-000000000005', 'prancha-joelhos',     null,   30,      null,      3),
    ('c0000001-0000-4000-8000-000000000005', 'marcha-estacionaria', null,   60,      null,      4),
    -- Fundação B+
    ('c0000001-0000-4000-8000-000000000006', 'bom-dia',               15, null,      null,      1),
    ('c0000001-0000-4000-8000-000000000006', 'afundo',                 8, null,      null,      2),
    ('c0000001-0000-4000-8000-000000000006', 'superman',              12, null,      null,      3),
    ('c0000001-0000-4000-8000-000000000006', 'elevacao-panturrilha',  15, null,      null,      4),
    -- Ritmo 2
    ('c0000001-0000-4000-8000-000000000007', 'polichinelo',           20, null,      null,      1),
    ('c0000001-0000-4000-8000-000000000007', 'corrida-estacionaria',null,   45,      null,      2),
    ('c0000001-0000-4000-8000-000000000007', 'agachamento',           12, null,      null,      3),
    ('c0000001-0000-4000-8000-000000000007', 'mountain-climber',      12, null,      null,      4),
    -- Centro 2
    ('c0000001-0000-4000-8000-000000000008', 'abdominal-supra',       15, null,      null,      1),
    ('c0000001-0000-4000-8000-000000000008', 'abdominal-infra',       12, null,      null,      2),
    ('c0000001-0000-4000-8000-000000000008', 'prancha',             null,   20,      null,      3),
    ('c0000001-0000-4000-8000-000000000008', 'russian-twist',         16, null,      null,      4),
    -- Referência 5·10·15
    ('c0000001-0000-4000-8000-000000000009', 'flexao-apoiada',         5, null,      null,      1),
    ('c0000001-0000-4000-8000-000000000009', 'agachamento',           10, null,      null,      2),
    ('c0000001-0000-4000-8000-000000000009', 'abdominal-supra',       15, null,      null,      3),
    -- Mobilidade guiada
    ('c0000001-0000-4000-8000-00000000000a', 'mobilidade-quadril',  null,   45,      null,      1),
    ('c0000001-0000-4000-8000-00000000000a', 'mobilidade-ombro',    null,   45,      null,      2),
    ('c0000001-0000-4000-8000-00000000000a', 'gato-camelo',           10, null,      null,      3),
    ('c0000001-0000-4000-8000-00000000000a', 'rotacao-toracica',       8, null,      null,      4),
    ('c0000001-0000-4000-8000-00000000000a', 'respiracao-diafragmatica', null, 60,   null,      5),
    -- Recuperação ativa
    ('c0000001-0000-4000-8000-00000000000b', 'caminhada',           null, null,      1500,      1),
    ('c0000001-0000-4000-8000-00000000000b', 'alongamento-posterior', null, 45,      null,      2),
    ('c0000001-0000-4000-8000-00000000000b', 'mobilidade-quadril',  null,   45,      null,      3),
    ('c0000001-0000-4000-8000-00000000000b', 'respiracao-diafragmatica', null, 120,  null,      4)
  ) as v (tpl, slug, reps, dur, dist, ord)
  join public.exercises e on e.slug = v.slug and e.owner_id is null;

-- -----------------------------------------------------------------------------
-- A trilha
-- -----------------------------------------------------------------------------
create type public.track_focus as enum (
  'forca', 'cardio', 'core', 'mobilidade', 'recuperacao', 'referencia'
);

create table public.tracks (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  -- a frase curta que aparece embaixo do nome
  tagline     text,
  -- a promessa: para quem é, o que exige e o que entrega
  description text not null,
  level       public.workout_level not null default 'iniciante',
  place       public.workout_place not null default 'casa',
  weeks       smallint not null,
  -- o nome de cada semana, na ordem. É o que dá arco ao programa: "Fundação"
  -- diz o que se espera da semana 1 de um jeito que "Semana 1" não diz.
  week_titles text[] not null default '{}',
  -- insígnia de quem termina; nula se a trilha não dá emblema
  badge_slug  text references public.badges (slug) on delete set null,
  is_active   boolean not null default true,
  sort_order  smallint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint track_slug_forma  check (slug ~ '^[a-z0-9-]{3,40}$'),
  constraint track_titulo_len  check (char_length(title) between 3 and 60),
  constraint track_semanas     check (weeks between 1 and 52),
  -- ou nomeia todas as semanas, ou nenhuma: uma lista pela metade vira semana
  -- sem nome no meio da tela, e o componente teria que adivinhar o que fazer
  constraint track_semana_nomes check (cardinality(week_titles) in (0, weeks))
);

create index tracks_ativas_idx on public.tracks (is_active, sort_order);

comment on table public.tracks is
  'Programas ordenados de treino. O progresso não mora aqui: é contado a partir dos treinos.';

create table public.track_sessions (
  id          uuid primary key default gen_random_uuid(),
  track_id    uuid not null references public.tracks (id) on delete cascade,
  -- 1 a N, na ordem em que as sessões acontecem
  position    smallint not null,
  week        smallint not null,
  title       text not null,
  focus       public.track_focus not null,
  -- a frase do treinador: por que esta sessão existe e o que observar nela
  note        text not null,
  -- o circuito. Nulo seria uma sessão sem treino, que a trilha não tem.
  template_id uuid not null references public.workout_templates (id) on delete restrict,

  constraint track_session_pos    check (position between 1 and 400),
  constraint track_session_semana check (week between 1 and 52),
  constraint track_session_nota   check (char_length(note) between 10 and 400)
);

create unique index track_sessions_pos_key on public.track_sessions (track_id, position);
create index track_sessions_template_idx on public.track_sessions (template_id);

create table public.track_enrollments (
  track_id     uuid not null references public.tracks (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  -- o dia em que a trilha começou a contar, no fuso da pessoa
  started_on   date not null,
  joined_at    timestamptz not null default now(),
  -- gravado por `concluir_trilha`; serve para não reentregar a insígnia
  completed_at timestamptz,

  primary key (track_id, user_id)
);

create index track_enrollments_user_idx on public.track_enrollments (user_id);

comment on column public.track_enrollments.started_on is
  'Dia em que a trilha começou a contar. Treino anterior a ele não avança a trilha.';

create trigger tracks_set_updated_at
  before update on public.tracks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Quem vê o quê
--
-- Catálogo e sessões são públicos: uma trilha que ninguém vê antes de entrar
-- não convence ninguém a entrar. A matrícula é só do dono — ao contrário do
-- desafio, aqui não há ranking para justificar leitura alheia.
-- -----------------------------------------------------------------------------
alter table public.tracks            enable row level security;
alter table public.track_sessions    enable row level security;
alter table public.track_enrollments enable row level security;

create policy "trilha leitura" on public.tracks for select to anon, authenticated
  using (is_active or public.eh_admin());

create policy "trilha admin escreve" on public.tracks for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

create policy "sessao leitura" on public.track_sessions for select to anon, authenticated
  using (
    exists (select 1 from public.tracks t where t.id = track_id and (t.is_active or public.eh_admin()))
  );

create policy "sessao admin escreve" on public.track_sessions for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

create policy "matricula minha" on public.track_enrollments for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

create policy "matriculo eu mesmo" on public.track_enrollments for insert to authenticated
  with check (user_id = auth.uid());

create policy "desmatriculo eu mesmo" on public.track_enrollments for delete to authenticated
  using (user_id = auth.uid() or public.eh_admin());

-- ninguém marca a própria conclusão: quem marca é `concluir_trilha`
create policy "conclusao admin" on public.track_enrollments for update to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

-- -----------------------------------------------------------------------------
-- Os dias que contam para a minha trilha
--
-- `security invoker`: a RLS de `workouts` já limita ao dono, e é exatamente
-- isso que se quer aqui — nenhuma trilha lê treino de outra pessoa.
--
-- Devolve os dias, e não a contagem, porque a conta acontece em
-- `services/tracks.ts`: o aparelho pode ter treino feito offline que ainda não
-- subiu, e a tela precisa somar os dois sem discordar de si mesma.
-- -----------------------------------------------------------------------------
create or replace function public.meus_dias_na_trilha(p_slug text)
returns setof date
language sql
security invoker
set search_path = public
stable
as $fn$
  select distinct w.workout_date
    from public.workouts w
    join public.track_enrollments m on m.user_id = auth.uid()
    join public.tracks t on t.id = m.track_id and t.slug = p_slug and t.is_active
   where w.user_id = auth.uid()
     and w.deleted_at is null
     and w.finished_at is not null
     and w.workout_date >= m.started_on
   order by 1;
$fn$;

-- -----------------------------------------------------------------------------
-- Conclusão: a insígnia cai quando as sessões acabam
--
-- Mesmo desenho de `concluir_desafio`: chamada ao abrir a tela, não por botão —
-- ninguém deveria precisar pedir a insígnia que já conquistou. Idempotente:
-- `completed_at` é a trava e a insígnia usa `on conflict do nothing`.
-- -----------------------------------------------------------------------------
create or replace function public.concluir_trilha(p_slug text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  t       public.tracks%rowtype;
  m       public.track_enrollments%rowtype;
  sessoes integer;
  feitos  integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into t from public.tracks where slug = p_slug and is_active;
  if not found then
    return false;
  end if;

  select * into m from public.track_enrollments
   where track_id = t.id and user_id = auth.uid();
  if not found or m.completed_at is not null then
    return false;
  end if;

  select count(*) into sessoes from public.track_sessions where track_id = t.id;

  select count(distinct w.workout_date) into feitos
    from public.workouts w
   where w.user_id = auth.uid()
     and w.deleted_at is null
     and w.finished_at is not null
     and w.workout_date >= m.started_on;

  if sessoes = 0 or feitos < sessoes then
    return false;
  end if;

  update public.track_enrollments
     set completed_at = now()
   where track_id = t.id and user_id = auth.uid();

  if t.badge_slug is not null then
    insert into public.user_badges (user_id, badge_slug, value)
    values (auth.uid(), t.badge_slug, feitos)
    on conflict (user_id, badge_slug) do nothing;
  end if;

  return true;
end;
$fn$;

-- `create ... function` concede execute a `public`, e `public` inclui `anon`.
-- Revogar só de anon/authenticated deixaria a concessão herdada de pé — foi o
-- erro que a 0035 teve que consertar nas funções de push.
revoke execute on function public.meus_dias_na_trilha(text) from public, anon, authenticated;
revoke execute on function public.concluir_trilha(text)     from public, anon, authenticated;

grant execute on function public.meus_dias_na_trilha(text) to authenticated;
grant execute on function public.concluir_trilha(text)     to authenticated;

-- -----------------------------------------------------------------------------
-- A insígnia de quem termina
--
-- Via Ápia: a primeira estrada de Roma, e a que sobrou inteira. É a imagem
-- certa para um programa cujo produto final não é o corpo do dia 28 — é o
-- caminho que passou a existir.
-- -----------------------------------------------------------------------------
insert into public.badges (slug, name, description, metric, threshold, tier, emblem, sort_order) values
  ('via-apia', 'Via Ápia',
   'As 28 sessões da Trilha do Iniciante. A primeira estrada de Roma é a que continua de pé.',
   'trilha', 28, 'ferro', 'caminho', 240)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- A Trilha do Iniciante em Casa
-- -----------------------------------------------------------------------------
insert into public.tracks
  (id, slug, title, tagline, description, level, place, weeks, week_titles, badge_slug, sort_order)
values (
  'a0000001-0000-4000-8000-000000000001',
  'iniciante-em-casa',
  'Trilha do Iniciante em Casa',
  '28 sessões, quatro semanas, nenhum equipamento',
  E'Para quem abriu o app, olhou os quinze treinos e não soube por onde começar.\n\nSão 28 sessões numeradas, na ordem em que um treinador colocaria: duas de força por semana, duas de condicionamento, uma de core, uma de mobilidade e uma de recuperação ativa. A intensidade sobe semana a semana; o tempo nunca passa de 20 minutos; nada aqui pede equipamento, academia ou espaço além de um tapete.\n\nNos dias 6, 13, 20 e 28 volta o mesmo circuito de referência. É a única medida honesta de progresso que quatro semanas oferecem: mesmo treino, mesmo tempo, número de rounds diferente.\n\nA trilha anda com os seus dias de treino, não com o calendário. Faltou terça? A sessão de terça te espera na quarta. E qualquer treino conta — a ordem é sugestão de quem entende, não portaria.',
  'iniciante', 'casa', 4, array['Fundação', 'Ritmo', 'Força', 'Graduação'], 'via-apia', 100
)
on conflict (slug) do update set
  title = excluded.title,
  tagline = excluded.tagline,
  description = excluded.description,
  weeks = excluded.weeks,
  week_titles = excluded.week_titles,
  badge_slug = excluded.badge_slug,
  sort_order = excluded.sort_order,
  is_active = true;

-- -----------------------------------------------------------------------------
-- As 28 sessões
--
-- Semanas 1 e 2 usam os circuitos de trilha, que são degraus. Semanas 3 e 4
-- usam a biblioteca do próprio app — de propósito: a trilha não termina num
-- beco, ela desemboca no lugar onde a pessoa vai treinar depois. No dia 15 ela
-- descobre que o "P20X Start" que a assustava no dia 1 virou o treino normal.
-- -----------------------------------------------------------------------------
delete from public.track_sessions
 where track_id = 'a0000001-0000-4000-8000-000000000001';

insert into public.track_sessions (track_id, position, week, title, focus, note, template_id)
values
  -- Semana 1 — Fundação
  ('a0000001-0000-4000-8000-000000000001',  1, 1, 'Fundação A', 'forca',
   'Hoje não é para cansar: é para o corpo aprender o caminho do movimento. Pare uma volta antes do que você aguentaria — amanhã tem mais.',
   'c0000001-0000-4000-8000-000000000001'),
  ('a0000001-0000-4000-8000-000000000001',  2, 1, 'Ritmo 1', 'cardio',
   'Cardio sem pulo e sem impacto. Se a respiração fechar, ande no lugar até ela voltar; parar de vez é que não.',
   'c0000001-0000-4000-8000-000000000003'),
  ('a0000001-0000-4000-8000-000000000001',  3, 1, 'Centro 1', 'core',
   'Abdômen começa pela lombar apoiada. Se ela levantar do chão, diminua a amplitude em vez de forçar — dor de lombar é o que tira iniciante de treino.',
   'c0000001-0000-4000-8000-000000000004'),
  ('a0000001-0000-4000-8000-000000000001',  4, 1, 'Mobilidade guiada', 'mobilidade',
   'Quinze minutos sem esforço nenhum. Este dia existe para você chegar inteiro na semana 2, e pular ele é o erro mais comum de quem está começando.',
   'c0000001-0000-4000-8000-00000000000a'),
  ('a0000001-0000-4000-8000-000000000001',  5, 1, 'Fundação B', 'forca',
   'Hoje é a parte de trás do corpo: quadril, glúteo e costas. É ela que segura a postura quando o resto cansa, e é a que quase todo programa esquece.',
   'c0000001-0000-4000-8000-000000000002'),
  ('a0000001-0000-4000-8000-000000000001',  6, 1, 'Referência 5·10·15', 'referencia',
   'Guarde este número de rounds. O mesmo circuito volta nos dias 13, 20 e 28, e é a diferença entre os quatro que mostra o que mudou.',
   'c0000001-0000-4000-8000-000000000009'),
  ('a0000001-0000-4000-8000-000000000001',  7, 1, 'Recuperação ativa', 'recuperacao',
   'Caminhar conta. Vinte minutos de corpo em movimento fazem mais pela semana que vem do que um dia inteiro parado.',
   'c0000001-0000-4000-8000-00000000000b'),

  -- Semana 2 — Ritmo
  ('a0000001-0000-4000-8000-000000000001',  8, 2, 'Fundação A+', 'forca',
   'A flexão sai da parede e desce para o chão, com os joelhos apoiados. Se der cinco por volta, são cinco: o degrau é esse mesmo.',
   'c0000001-0000-4000-8000-000000000005'),
  ('a0000001-0000-4000-8000-000000000001',  9, 2, 'Ritmo 2', 'cardio',
   'Entra impacto. Aterrisse com o joelho macio, nunca travado, e prefira menos rounds a qualquer aterrissagem dura.',
   'c0000001-0000-4000-8000-000000000007'),
  ('a0000001-0000-4000-8000-000000000001', 10, 2, 'Centro 1', 'core',
   'O mesmo circuito da semana passada, de propósito. Repetir é como se aprende a fazer certo — e você vai sentir que ficou mais fácil.',
   'c0000001-0000-4000-8000-000000000004'),
  ('a0000001-0000-4000-8000-000000000001', 11, 2, 'Mobilidade guiada', 'mobilidade',
   'Dia leve no meio de uma semana mais pesada. Não é folga: é o que permite treinar amanhã.',
   'c0000001-0000-4000-8000-00000000000a'),
  ('a0000001-0000-4000-8000-000000000001', 12, 2, 'Fundação B+', 'forca',
   'Mais volume na mesma base, e o afundo entra. Uma perna de cada vez, sem pressa: joelho da frente na linha do pé.',
   'c0000001-0000-4000-8000-000000000006'),
  ('a0000001-0000-4000-8000-000000000001', 13, 2, 'Referência 5·10·15', 'referencia',
   'Segunda medida. Compare com o dia 6 antes de seguir — duas semanas costumam valer um ou dois rounds a mais.',
   'c0000001-0000-4000-8000-000000000009'),
  ('a0000001-0000-4000-8000-000000000001', 14, 2, 'Recuperação ativa', 'recuperacao',
   'Metade da trilha. Duas semanas atrás isto aqui era só uma ideia na tela.',
   'c0000001-0000-4000-8000-00000000000b'),

  -- Semana 3 — Força
  ('a0000001-0000-4000-8000-000000000001', 15, 3, 'P20X Start', 'forca',
   'A partir de hoje você treina com a biblioteca do app, sem versão reduzida. Este é o primeiro treino do P20X, e ele já é seu.',
   'b0000001-0000-4000-8000-000000000001'),
  ('a0000001-0000-4000-8000-000000000001', 16, 3, 'Ritmo 2', 'cardio',
   'Você já fez este circuito no dia 9. A meta de hoje é simples: um round a mais do que naquele dia.',
   'c0000001-0000-4000-8000-000000000007'),
  ('a0000001-0000-4000-8000-000000000001', 17, 3, 'Centro 2', 'core',
   'A prancha sai dos joelhos. Vinte segundos com o quadril na linha do tronco valem mais que quarenta com ele caído.',
   'c0000001-0000-4000-8000-000000000008'),
  ('a0000001-0000-4000-8000-000000000001', 18, 3, 'Mobilidade guiada', 'mobilidade',
   'A terceira semana é onde a dor de treino acumulada aparece. Este dia é o que dissolve ela.',
   'c0000001-0000-4000-8000-00000000000a'),
  ('a0000001-0000-4000-8000-000000000001', 19, 3, 'P20X Move', 'cardio',
   'Condicionamento sem sair do lugar: nenhum equipamento, nenhum espaço. É o treino para os dias em que nada colabora.',
   'b0000001-0000-4000-8000-000000000005'),
  ('a0000001-0000-4000-8000-000000000001', 20, 3, 'Referência 5·10·15', 'referencia',
   'Terceira medida, e faltam oito sessões. Se o número não subiu desta vez, olhe o sono e a comida antes de olhar o treino.',
   'c0000001-0000-4000-8000-000000000009'),
  ('a0000001-0000-4000-8000-000000000001', 21, 3, 'Recuperação ativa', 'recuperacao',
   'Ande, alongue, respire. A semana que vem é a última.',
   'c0000001-0000-4000-8000-00000000000b'),

  -- Semana 4 — Graduação
  ('a0000001-0000-4000-8000-000000000001', 22, 4, 'P20X Base', 'forca',
   'Flexão completa no chão. Se ainda não sair, faça nos joelhos e siga — a trilha não trava por causa disso, e a flexão vem.',
   'b0000001-0000-4000-8000-000000000002'),
  ('a0000001-0000-4000-8000-000000000001', 23, 4, 'P20X Cardio Start', 'cardio',
   'Sem corda em casa? Troque as 50 cordas por 45 segundos de marcha estacionária. O circuito é o mesmo.',
   'b0000001-0000-4000-8000-000000000003'),
  ('a0000001-0000-4000-8000-000000000001', 24, 4, 'Mobilidade guiada', 'mobilidade',
   'Última vez que a trilha marca este dia. Depois dela, ele passa a ser escolha sua — e vale manter uma por semana.',
   'c0000001-0000-4000-8000-00000000000a'),
  ('a0000001-0000-4000-8000-000000000001', 25, 4, 'P20X Move', 'cardio',
   'Você fez este no dia 19. Puxe os rounds hoje: falta pouco para a última medida.',
   'b0000001-0000-4000-8000-000000000005'),
  ('a0000001-0000-4000-8000-000000000001', 26, 4, 'Centro 2', 'core',
   'Core de novo, e agora você sabe fazer. Repare em como a prancha mudou desde o dia 3.',
   'c0000001-0000-4000-8000-000000000008'),
  ('a0000001-0000-4000-8000-000000000001', 27, 4, 'Recuperação ativa', 'recuperacao',
   'Amanhã é a última medida. Chegue nela descansado — é assim que se mede o que se construiu.',
   'c0000001-0000-4000-8000-00000000000b'),
  ('a0000001-0000-4000-8000-000000000001', 28, 4, 'Referência 5·10·15', 'referencia',
   'O mesmo circuito do dia 6. Olhe os dois números lado a lado: é isso que 28 sessões fizeram. Daqui em diante a biblioteca inteira é sua.',
   'c0000001-0000-4000-8000-000000000009');
