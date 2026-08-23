-- =============================================================================
-- P20X · 0009 — biblioteca de treinos
--
-- Todos seguem o mesmo princípio, e é isso que simplifica o produto: um
-- circuito curto, repetido no seu ritmo durante 20 minutos, contando rounds.
-- O número de rounds vira o indicador de evolução — dia 1 com 5 rounds e dia
-- 20 com 8 diz mais sobre progresso do que qualquer estimativa de caloria.
-- =============================================================================

-- Método de execução do treino. AMRAP: o máximo de voltas que der no tempo.
create type public.workout_method as enum ('amrap', 'livre');

alter table public.workout_templates
  add column method public.workout_method not null default 'amrap',
  add column subtitle text;

comment on column public.workout_templates.method is
  'Como o treino é executado. AMRAP repete o circuito até o tempo acabar.';
comment on column public.workout_templates.subtitle is
  'Uma linha sobre o objetivo, mostrada no cartão antes dos exercícios.';

-- -----------------------------------------------------------------------------
-- Exercícios que faltavam para a biblioteca nova
-- -----------------------------------------------------------------------------
insert into public.exercises (slug, name, category, modality, equipment, instructions) values
  ('flexao-apoiada',   'Flexão apoiada nos joelhos', 'peito',  'reps', '{}',
   'Mesma execução da flexão, com os joelhos no chão. Serve de degrau para a flexão completa.'),
  ('flexao-ombros',    'Flexão com ênfase nos ombros', 'ombros', 'reps', '{}',
   'Quadril elevado, tronco inclinado para a frente. Joga o esforço para os ombros.'),
  ('marcha-estacionaria', 'Marcha estacionária', 'cardio', 'time', '{}',
   'Alternativa à corda para quem ainda não pula: joelhos alternados, sem impacto.')
on conflict (slug) where owner_id is null do nothing;

-- -----------------------------------------------------------------------------
-- Fora a biblioteca antiga do sistema. Templates que alguém salvou continuam:
-- só os do sistema (owner_id null) são substituídos.
-- -----------------------------------------------------------------------------
update public.workout_templates
   set is_active = false, deleted_at = now()
 where owner_id is null and deleted_at is null;

-- -----------------------------------------------------------------------------
-- P20X · 15 treinos, três níveis
-- -----------------------------------------------------------------------------
insert into public.workout_templates
  (id, owner_id, title, subtitle, description, level, place, tags, estimated_seconds, method) values

  ('b0000001-0000-4000-8000-000000000001', null, 'P20X Start',
   'Para quem está começando do zero',
   'Repita o circuito no seu ritmo durante 20 minutos. Descanse sempre que precisar — o objetivo é terminar, não competir.',
   'iniciante', 'casa', '{corpo_inteiro,sem_equipamento}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-000000000002', null, 'P20X Base',
   'O degrau seguinte, ainda sem equipamento',
   'Repita o circuito no seu ritmo durante 20 minutos. Anote os rounds: eles são a sua evolução.',
   'iniciante', 'casa', '{corpo_inteiro,sem_equipamento}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-000000000003', null, 'P20X Cardio Start',
   'Primeiro contato com a corda',
   'Repita o circuito durante 20 minutos. Sem corda? Troque por 45 segundos de marcha estacionária.',
   'iniciante', 'casa', '{cardio}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-000000000004', null, 'P20X Core Start',
   'Abdômen sem exagero',
   'Repita o circuito durante 20 minutos, com pausa entre as voltas sempre que precisar.',
   'iniciante', 'casa', '{core,sem_equipamento}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-000000000005', null, 'P20X Move',
   'Condicionamento sem sair do lugar',
   'Repita o circuito durante 20 minutos. Nenhum equipamento, nenhum espaço.',
   'iniciante', 'casa', '{cardio,corpo_inteiro,sem_equipamento}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-000000000006', null, 'P20X 5•10•15',
   'O circuito que virou o padrão do método',
   'Repita o circuito durante 20 minutos. Quantos rounds você fecha hoje?',
   'intermediario', 'misto', '{corpo_inteiro,superiores,inferiores}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-000000000007', null, 'P20X 100',
   'Corda como base, força como consequência',
   'Repita o circuito durante 20 minutos. Seis rounds já são 600 cordas.',
   'intermediario', 'casa', '{cardio,core}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-000000000008', null, 'P20X Runner',
   'Para quem não tem corda',
   'Repita o circuito durante 20 minutos, no seu ritmo.',
   'intermediario', 'casa', '{cardio,corpo_inteiro,sem_equipamento}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-000000000009', null, 'P20X Core 40',
   'Quarenta abdominais por volta',
   'Repita o circuito durante 20 minutos. O 40 aqui é o volume do round, não a idade.',
   'intermediario', 'casa', '{core,sem_equipamento}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-00000000000a', null, 'P20X Legs',
   'Pernas de verdade, sem barra',
   'Repita o circuito durante 20 minutos. Avanços alternando as pernas.',
   'intermediario', 'casa', '{inferiores,cardio,sem_equipamento}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-00000000000b', null, 'P20X 5•10•15 X',
   'A versão puxada do padrão',
   'A meta é fechar 10 rounds em 20 minutos: 50 barras, 100 flexões e 150 agachamentos.',
   'avancado', 'misto', '{corpo_inteiro,superiores,inferiores}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-00000000000c', null, 'P20X 100•20•20',
   'Condicionamento em volume alto',
   'Repita o circuito durante 20 minutos. Se pesar demais, corte os agachamentos pela metade.',
   'avancado', 'casa', '{cardio,corpo_inteiro}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-00000000000d', null, 'P20X Upper',
   'Superiores concentrado',
   'Repita o circuito durante 20 minutos. Evite repetir no dia seguinte a outro treino pesado de superiores.',
   'avancado', 'externa', '{superiores}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-00000000000e', null, 'P20X Core X',
   'Corda e abdômen alternados',
   'Repita o circuito durante 20 minutos. Bom para intercalar com um dia de muito volume de braços.',
   'avancado', 'casa', '{cardio,core}', 1200, 'amrap'),

  ('b0000001-0000-4000-8000-00000000000f', null, 'P20X Challenge',
   'Tudo junto, para quando quiser apanhar',
   'Repita o circuito durante 20 minutos. Seis rounds são 600 cordas, 30 barras, 60 flexões e 90 agachamentos.',
   'avancado', 'misto', '{corpo_inteiro,cardio,superiores,inferiores}', 1200, 'amrap')

on conflict (id) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  level = excluded.level,
  place = excluded.place,
  tags = excluded.tags,
  method = excluded.method,
  is_active = true,
  deleted_at = null;

-- -----------------------------------------------------------------------------
-- Os rounds de cada treino
-- -----------------------------------------------------------------------------
delete from public.workout_template_exercises
 where template_id in (
   select id from public.workout_templates
    where owner_id is null and id::text like 'b0000001-%'
 );

insert into public.workout_template_exercises
  (template_id, exercise_id, sets, repetitions, duration_seconds, order_index)
select v.tpl::uuid, e.id, 1, v.reps, v.dur, v.ord
  from (values
    -- Start
    ('b0000001-0000-4000-8000-000000000001', 'agachamento',           5, null::int, 1),
    ('b0000001-0000-4000-8000-000000000001', 'flexao-inclinada',      5, null,      2),
    ('b0000001-0000-4000-8000-000000000001', 'abdominal-supra',      10, null,      3),
    -- Base
    ('b0000001-0000-4000-8000-000000000002', 'agachamento',          10, null,      1),
    ('b0000001-0000-4000-8000-000000000002', 'flexao',                5, null,      2),
    ('b0000001-0000-4000-8000-000000000002', 'abdominal-supra',      10, null,      3),
    -- Cardio Start
    ('b0000001-0000-4000-8000-000000000003', 'corda',                50, null,      1),
    ('b0000001-0000-4000-8000-000000000003', 'agachamento',          10, null,      2),
    ('b0000001-0000-4000-8000-000000000003', 'abdominal-supra',      10, null,      3),
    -- Core Start
    ('b0000001-0000-4000-8000-000000000004', 'abdominal-supra',      10, null,      1),
    ('b0000001-0000-4000-8000-000000000004', 'abdominal-infra',      10, null,      2),
    ('b0000001-0000-4000-8000-000000000004', 'prancha',            null,   20,      3),
    -- Move
    ('b0000001-0000-4000-8000-000000000005', 'corrida-estacionaria', null,  60,      1),
    ('b0000001-0000-4000-8000-000000000005', 'agachamento',          10, null,      2),
    ('b0000001-0000-4000-8000-000000000005', 'flexao',                5, null,      3),
    -- 5•10•15
    ('b0000001-0000-4000-8000-000000000006', 'barra-fixa',            5, null,      1),
    ('b0000001-0000-4000-8000-000000000006', 'flexao',               10, null,      2),
    ('b0000001-0000-4000-8000-000000000006', 'agachamento',          15, null,      3),
    -- 100
    ('b0000001-0000-4000-8000-000000000007', 'corda',               100, null,      1),
    ('b0000001-0000-4000-8000-000000000007', 'flexao',               10, null,      2),
    ('b0000001-0000-4000-8000-000000000007', 'abdominal-supra',      20, null,      3),
    -- Runner
    ('b0000001-0000-4000-8000-000000000008', 'corrida-estacionaria', null,  60,      1),
    ('b0000001-0000-4000-8000-000000000008', 'flexao',               10, null,      2),
    ('b0000001-0000-4000-8000-000000000008', 'agachamento',          15, null,      3),
    ('b0000001-0000-4000-8000-000000000008', 'abdominal-supra',      10, null,      4),
    -- Core 40
    ('b0000001-0000-4000-8000-000000000009', 'abdominal-supra',      20, null,      1),
    ('b0000001-0000-4000-8000-000000000009', 'abdominal-infra',      20, null,      2),
    ('b0000001-0000-4000-8000-000000000009', 'flexao',               10, null,      3),
    -- Legs
    ('b0000001-0000-4000-8000-00000000000a', 'agachamento',          20, null,      1),
    ('b0000001-0000-4000-8000-00000000000a', 'afundo',               20, null,      2),
    ('b0000001-0000-4000-8000-00000000000a', 'corrida-estacionaria', null,  30,      3),
    -- 5•10•15 X
    ('b0000001-0000-4000-8000-00000000000b', 'barra-fixa',            5, null,      1),
    ('b0000001-0000-4000-8000-00000000000b', 'flexao',               10, null,      2),
    ('b0000001-0000-4000-8000-00000000000b', 'agachamento',          15, null,      3),
    -- 100•20•20
    ('b0000001-0000-4000-8000-00000000000c', 'corda',               100, null,      1),
    ('b0000001-0000-4000-8000-00000000000c', 'agachamento',          20, null,      2),
    ('b0000001-0000-4000-8000-00000000000c', 'abdominal-supra',      20, null,      3),
    -- Upper
    ('b0000001-0000-4000-8000-00000000000d', 'barra-fixa',            5, null,      1),
    ('b0000001-0000-4000-8000-00000000000d', 'flexao',               10, null,      2),
    ('b0000001-0000-4000-8000-00000000000d', 'flexao-ombros',         5, null,      3),
    -- Core X
    ('b0000001-0000-4000-8000-00000000000e', 'corda',               100, null,      1),
    ('b0000001-0000-4000-8000-00000000000e', 'abdominal-supra',      20, null,      2),
    ('b0000001-0000-4000-8000-00000000000e', 'abdominal-infra',      20, null,      3),
    -- Challenge
    ('b0000001-0000-4000-8000-00000000000f', 'corda',               100, null,      1),
    ('b0000001-0000-4000-8000-00000000000f', 'barra-fixa',            5, null,      2),
    ('b0000001-0000-4000-8000-00000000000f', 'flexao',               10, null,      3),
    ('b0000001-0000-4000-8000-00000000000f', 'agachamento',          15, null,      4)
  ) as v (tpl, ex_slug, reps, dur, ord)
  join public.exercises e on e.slug = v.ex_slug and e.owner_id is null;
