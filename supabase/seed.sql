-- =============================================================================
-- PROTOCOLO40 — seed
-- Biblioteca de exercícios do sistema e sugestões de treino de ~20 minutos.
-- Idempotente: pode rodar quantas vezes for preciso.
-- Nenhum destes dados é hardcoded em componente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Exercícios (owner_id NULL = sistema)
-- -----------------------------------------------------------------------------
insert into public.exercises (slug, name, category, modality, equipment) values
  -- peito
  ('flexao',                  'Flexão',                      'peito',        'reps',     '{}'),
  ('flexao-diamante',         'Flexão diamante',             'peito',        'reps',     '{}'),
  ('flexao-inclinada',        'Flexão inclinada',            'peito',        'reps',     '{banco}'),
  ('flexao-declinada',        'Flexão declinada',            'peito',        'reps',     '{banco}'),
  ('supino-reto',             'Supino reto',                 'peito',        'load',     '{barra,banco}'),
  ('supino-inclinado',        'Supino inclinado',            'peito',        'load',     '{halteres,banco}'),
  ('crucifixo',               'Crucifixo',                   'peito',        'load',     '{halteres,banco}'),
  -- costas
  ('barra-fixa',              'Barra fixa',                  'costas',       'reps',     '{barra-fixa}'),
  ('barra-fixa-supinada',     'Barra fixa supinada',         'costas',       'reps',     '{barra-fixa}'),
  ('barra-australiana',       'Barra australiana',           'costas',       'reps',     '{barra-baixa}'),
  ('remada-curvada',          'Remada curvada',              'costas',       'load',     '{barra}'),
  ('remada-unilateral',       'Remada unilateral',           'costas',       'load',     '{halteres}'),
  ('puxada-alta',             'Puxada alta',                 'costas',       'load',     '{polia}'),
  ('superman',                'Superman',                    'costas',       'reps',     '{}'),
  -- ombros
  ('desenvolvimento',         'Desenvolvimento',             'ombros',       'load',     '{halteres}'),
  ('elevacao-lateral',        'Elevação lateral',            'ombros',       'load',     '{halteres}'),
  ('elevacao-frontal',        'Elevação frontal',            'ombros',       'load',     '{halteres}'),
  ('flexao-pike',             'Flexão pike',                 'ombros',       'reps',     '{}'),
  ('encolhimento',            'Encolhimento',                'ombros',       'load',     '{halteres}'),
  -- braços
  ('rosca-direta',            'Rosca direta',                'bracos',       'load',     '{halteres}'),
  ('rosca-martelo',           'Rosca martelo',               'bracos',       'load',     '{halteres}'),
  ('triceps-banco',           'Tríceps no banco',            'bracos',       'reps',     '{banco}'),
  ('triceps-testa',           'Tríceps testa',               'bracos',       'load',     '{barra,banco}'),
  ('triceps-corda',           'Tríceps corda',               'bracos',       'load',     '{polia}'),
  ('mergulho-paralelas',      'Mergulho nas paralelas',      'bracos',       'reps',     '{paralelas}'),
  -- pernas
  ('agachamento',             'Agachamento',                 'pernas',       'reps',     '{}'),
  ('agachamento-livre',       'Agachamento livre',           'pernas',       'load',     '{barra}'),
  ('agachamento-sumo',        'Agachamento sumô',            'pernas',       'reps',     '{}'),
  ('afundo',                  'Afundo',                      'pernas',       'reps',     '{}'),
  ('passada',                 'Passada',                     'pernas',       'reps',     '{}'),
  ('agachamento-bulgaro',     'Agachamento búlgaro',         'pernas',       'reps',     '{banco}'),
  ('levantamento-terra',      'Levantamento terra',          'pernas',       'load',     '{barra}'),
  ('stiff',                   'Stiff',                       'pernas',       'load',     '{halteres}'),
  ('elevacao-panturrilha',    'Elevação de panturrilha',     'pernas',       'reps',     '{}'),
  ('ponte-gluteo',            'Ponte de glúteo',             'pernas',       'reps',     '{}'),
  ('cadeira-na-parede',       'Cadeira na parede',           'pernas',       'time',     '{}'),
  -- abdômen
  ('abdominal-supra',         'Abdominal supra',             'abdomen',      'reps',     '{}'),
  ('abdominal-infra',         'Abdominal infra',             'abdomen',      'reps',     '{}'),
  ('abdominal-obliquo',       'Abdominal oblíquo',           'abdomen',      'reps',     '{}'),
  ('prancha',                 'Prancha',                     'abdomen',      'time',     '{}'),
  ('prancha-lateral',         'Prancha lateral',             'abdomen',      'time',     '{}'),
  ('elevacao-pernas',         'Elevação de pernas',          'abdomen',      'reps',     '{}'),
  ('russian-twist',           'Russian twist',               'abdomen',      'reps',     '{}'),
  ('hollow-hold',             'Hollow hold',                 'abdomen',      'time',     '{}'),
  ('dead-bug',                'Dead bug',                    'abdomen',      'reps',     '{}'),
  -- cardio
  ('corrida',                 'Corrida',                     'cardio',       'distance', '{}'),
  ('corrida-estacionaria',    'Corrida estacionária',        'cardio',       'time',     '{}'),
  ('corda',                   'Corda',                       'cardio',       'reps',     '{corda}'),
  ('polichinelo',             'Polichinelo',                 'cardio',       'reps',     '{}'),
  ('mountain-climber',        'Mountain climber',            'cardio',       'reps',     '{}'),
  ('escalador',               'Escalador',                   'cardio',       'time',     '{}'),
  ('bicicleta',               'Bicicleta',                   'cardio',       'distance', '{bicicleta}'),
  ('caminhada',               'Caminhada',                   'cardio',       'distance', '{}'),
  ('remo-ergometro',          'Remo ergômetro',              'cardio',       'distance', '{remo}'),
  -- corpo inteiro
  ('burpee',                  'Burpee',                      'corpo_inteiro','reps',     '{}'),
  ('thruster',                'Thruster',                    'corpo_inteiro','load',     '{halteres}'),
  ('kettlebell-swing',        'Kettlebell swing',            'corpo_inteiro','reps',     '{kettlebell}'),
  ('bear-crawl',              'Bear crawl',                  'corpo_inteiro','time',     '{}'),
  ('turkish-get-up',          'Turkish get-up',              'corpo_inteiro','reps',     '{kettlebell}'),
  -- mobilidade
  ('alongamento-posterior',   'Alongamento posterior',       'mobilidade',   'time',     '{}'),
  ('gato-camelo',             'Gato e camelo',               'mobilidade',   'reps',     '{}'),
  ('mobilidade-quadril',      'Mobilidade de quadril',       'mobilidade',   'time',     '{}'),
  ('mobilidade-ombro',        'Mobilidade de ombro',         'mobilidade',   'time',     '{}'),
  ('rotacao-toracica',        'Rotação torácica',            'mobilidade',   'reps',     '{}'),
  ('respiracao-diafragmatica','Respiração diafragmática',    'mobilidade',   'time',     '{}')
on conflict (slug) where owner_id is null do nothing;

-- -----------------------------------------------------------------------------
-- Sugestões de treino (templates do sistema)
-- UUIDs fixos para que o seed seja idempotente.
-- -----------------------------------------------------------------------------
insert into public.workout_templates (id, owner_id, title, description, level, place, tags, estimated_seconds) values
  ('a0000001-0000-4000-8000-000000000001', null, 'Tom Holland',
   'O clássico. Repita o circuito o máximo de vezes em 20 minutos e anote os rounds.',
   'intermediario', 'casa', '{corpo_inteiro,sem_equipamento,superiores,inferiores}', 1200),

  ('a0000001-0000-4000-8000-000000000002', null, 'Primeiro dia',
   'Para quem está começando hoje. Sem equipamento, sem desculpa.',
   'iniciante', 'casa', '{iniciante,sem_equipamento,corpo_inteiro}', 1200),

  ('a0000001-0000-4000-8000-000000000003', null, 'Core em 20',
   'Abdômen e lombar. Circuito curto, descanso curto.',
   'intermediario', 'casa', '{core,sem_equipamento}', 1200),

  ('a0000001-0000-4000-8000-000000000004', null, 'Superiores sem equipamento',
   'Peito, ombro e tríceps usando só o peso do corpo.',
   'intermediario', 'casa', '{superiores,sem_equipamento}', 1200),

  ('a0000001-0000-4000-8000-000000000005', null, 'Pernas em casa',
   'Volume de pernas e glúteo sem carga externa.',
   'iniciante', 'casa', '{inferiores,sem_equipamento}', 1200),

  ('a0000001-0000-4000-8000-000000000006', null, 'Cardio 20',
   'Frequência cardíaca alta do começo ao fim.',
   'intermediario', 'casa', '{cardio,sem_equipamento}', 1200),

  ('a0000001-0000-4000-8000-000000000007', null, 'Barra e chão',
   'Para quem tem uma barra fixa. Puxar, empurrar, agachar.',
   'avancado', 'externa', '{superiores,corpo_inteiro}', 1200),

  ('a0000001-0000-4000-8000-000000000008', null, 'Academia — superiores',
   'Peito e costas com carga, em 20 minutos bem usados.',
   'intermediario', 'academia', '{superiores,academia}', 1200),

  ('a0000001-0000-4000-8000-000000000009', null, 'Academia — inferiores',
   'Agachamento, terra e panturrilha.',
   'intermediario', 'academia', '{inferiores,academia}', 1200),

  ('a0000001-0000-4000-8000-00000000000a', null, 'Recuperação ativa',
   'Dia leve. Mobilidade e respiração — continua contando na sequência.',
   'iniciante', 'casa', '{recuperacao_ativa,mobilidade,sem_equipamento}', 1200),

  ('a0000001-0000-4000-8000-00000000000b', null, 'Corda e core',
   'Alternando corda e abdômen. Simples e duro.',
   'avancado', 'casa', '{cardio,core}', 1200),

  ('a0000001-0000-4000-8000-00000000000c', null, 'Corpo inteiro avançado',
   'Burpee, barra e agachamento. Para quem já tem base.',
   'avancado', 'misto', '{corpo_inteiro,avancado}', 1200)
on conflict (id) do nothing;

insert into public.workout_template_exercises
  (template_id, exercise_id, sets, repetitions, duration_seconds, order_index)
select v.tpl::uuid, e.id, v.sets, v.reps, v.dur, v.ord
  from (values
    -- Tom Holland
    ('a0000001-0000-4000-8000-000000000001', 'barra-fixa',            1,    5, null::int, 1),
    ('a0000001-0000-4000-8000-000000000001', 'flexao',                1,   10, null,      2),
    ('a0000001-0000-4000-8000-000000000001', 'agachamento',           1,   15, null,      3),
    -- Primeiro dia
    ('a0000001-0000-4000-8000-000000000002', 'polichinelo',           3,   20, null,      1),
    ('a0000001-0000-4000-8000-000000000002', 'agachamento',           3,   10, null,      2),
    ('a0000001-0000-4000-8000-000000000002', 'flexao-inclinada',      3,    8, null,      3),
    ('a0000001-0000-4000-8000-000000000002', 'prancha',               3, null,        20, 4),
    -- Core em 20
    ('a0000001-0000-4000-8000-000000000003', 'abdominal-supra',       4,   20, null,      1),
    ('a0000001-0000-4000-8000-000000000003', 'abdominal-infra',       4,   15, null,      2),
    ('a0000001-0000-4000-8000-000000000003', 'prancha',               4, null,        45, 3),
    ('a0000001-0000-4000-8000-000000000003', 'russian-twist',         4,   30, null,      4),
    ('a0000001-0000-4000-8000-000000000003', 'hollow-hold',           4, null,        30, 5),
    -- Superiores sem equipamento
    ('a0000001-0000-4000-8000-000000000004', 'flexao',                5,   12, null,      1),
    ('a0000001-0000-4000-8000-000000000004', 'flexao-diamante',       5,    8, null,      2),
    ('a0000001-0000-4000-8000-000000000004', 'flexao-pike',           5,   10, null,      3),
    ('a0000001-0000-4000-8000-000000000004', 'triceps-banco',         5,   12, null,      4),
    -- Pernas em casa
    ('a0000001-0000-4000-8000-000000000005', 'agachamento',           4,   20, null,      1),
    ('a0000001-0000-4000-8000-000000000005', 'afundo',                4,   12, null,      2),
    ('a0000001-0000-4000-8000-000000000005', 'ponte-gluteo',          4,   20, null,      3),
    ('a0000001-0000-4000-8000-000000000005', 'cadeira-na-parede',     4, null,        45, 4),
    ('a0000001-0000-4000-8000-000000000005', 'elevacao-panturrilha',  4,   25, null,      5),
    -- Cardio 20
    ('a0000001-0000-4000-8000-000000000006', 'polichinelo',           5,   40, null,      1),
    ('a0000001-0000-4000-8000-000000000006', 'mountain-climber',      5,   30, null,      2),
    ('a0000001-0000-4000-8000-000000000006', 'burpee',                5,   10, null,      3),
    ('a0000001-0000-4000-8000-000000000006', 'corrida-estacionaria',  5, null,        60, 4),
    -- Barra e chão
    ('a0000001-0000-4000-8000-000000000007', 'barra-fixa',            6,    6, null,      1),
    ('a0000001-0000-4000-8000-000000000007', 'mergulho-paralelas',    6,    8, null,      2),
    ('a0000001-0000-4000-8000-000000000007', 'agachamento-sumo',      6,   15, null,      3),
    ('a0000001-0000-4000-8000-000000000007', 'elevacao-pernas',       6,   12, null,      4),
    -- Academia superiores
    ('a0000001-0000-4000-8000-000000000008', 'supino-reto',           4,   10, null,      1),
    ('a0000001-0000-4000-8000-000000000008', 'remada-curvada',        4,   10, null,      2),
    ('a0000001-0000-4000-8000-000000000008', 'puxada-alta',           4,   12, null,      3),
    ('a0000001-0000-4000-8000-000000000008', 'elevacao-lateral',      4,   15, null,      4),
    -- Academia inferiores
    ('a0000001-0000-4000-8000-000000000009', 'agachamento-livre',     4,   10, null,      1),
    ('a0000001-0000-4000-8000-000000000009', 'levantamento-terra',    4,    8, null,      2),
    ('a0000001-0000-4000-8000-000000000009', 'agachamento-bulgaro',   3,   12, null,      3),
    ('a0000001-0000-4000-8000-000000000009', 'elevacao-panturrilha',  4,   20, null,      4),
    -- Recuperação ativa
    ('a0000001-0000-4000-8000-00000000000a', 'mobilidade-quadril',    2, null,       120, 1),
    ('a0000001-0000-4000-8000-00000000000a', 'mobilidade-ombro',      2, null,       120, 2),
    ('a0000001-0000-4000-8000-00000000000a', 'gato-camelo',           2,   15, null,      3),
    ('a0000001-0000-4000-8000-00000000000a', 'alongamento-posterior', 2, null,       120, 4),
    ('a0000001-0000-4000-8000-00000000000a', 'respiracao-diafragmatica', 1, null,    180, 5),
    -- Corda e core
    ('a0000001-0000-4000-8000-00000000000b', 'corda',                 6,  100, null,      1),
    ('a0000001-0000-4000-8000-00000000000b', 'abdominal-supra',       6,   20, null,      2),
    ('a0000001-0000-4000-8000-00000000000b', 'prancha',               6, null,        30, 3),
    -- Corpo inteiro avançado
    ('a0000001-0000-4000-8000-00000000000c', 'burpee',                1,   10, null,      1),
    ('a0000001-0000-4000-8000-00000000000c', 'barra-fixa',            1,    8, null,      2),
    ('a0000001-0000-4000-8000-00000000000c', 'agachamento',           1,   20, null,      3),
    ('a0000001-0000-4000-8000-00000000000c', 'kettlebell-swing',      1,   15, null,      4)
  ) as v (tpl, ex_slug, sets, reps, dur, ord)
  join public.exercises e on e.slug = v.ex_slug and e.owner_id is null
on conflict (template_id, order_index) do nothing;
