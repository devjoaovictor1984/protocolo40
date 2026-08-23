-- =============================================================================
-- P20X — seed
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
-- Os treinos do sistema (a biblioteca P20X) vivem na migration 0009.
--
-- Conteúdo de produto que muda junto com o schema — como a coluna `method`,
-- que nasceu com ela — fica na migration, para que um banco novo receba tudo
-- na ordem certa sem depender de rodar o seed.
-- -----------------------------------------------------------------------------
