-- =============================================================================
-- P20X · 0044 — as insígnias dos doze meses
--
-- Existia uma: `setembro`, criada junto com o primeiro desafio. Isso fazia com
-- que criar o desafio de outubro exigisse uma migration — ou seja, um deploy —
-- só para existir a insígnia que ele entrega. Decisão de comunicação virando
-- tarefa de programador, exatamente o que o `image_path` foi criado para evitar.
--
-- Com os doze meses no catálogo, criar um desafio mensal passa a ser: escolher o
-- mês no painel. O ano não entra no slug de propósito — a insígnia de Março é a
-- mesma em 2026 e em 2027, porque quem já a tem não deveria ganhá-la de novo por
-- repetir o mesmo mês no ano seguinte, e `user_badges` tem chave
-- `(user_id, badge_slug)` justamente para isso.
--
-- **O `threshold` aqui é decorativo.** Quem decide se a insígnia cai é
-- `concluir_desafio()`, comparando os dias treinados com `challenges.goal` — o
-- número do desafio, não o da insígnia. Fica em zero para não sugerir uma regra
-- que ninguém lê.
--
-- **Todas douradas.** Ouro é reservado ao que é difícil e datado, e um mês
-- fechado é as duas coisas. Um mês não é mais difícil que outro; graduar por
-- tier inventaria uma hierarquia entre janeiro e julho que não existe.
--
-- **O emblema é o numeral romano do mês**, dentro do louro. Reaproveitar doze
-- desenhos que já significam outra coisa (âncora, tocha, martelo) embaralharia
-- o catálogo: a pessoa veria a tocha e não saberia se é a de sequência ou a de
-- março. Ver `MESES_DESENHADOS` em `features/badges/components/emblem.tsx`.
-- =============================================================================

insert into public.badges (slug, name, description, metric, threshold, tier, emblem, sort_order)
values
  ('janeiro',   'Janeiro',   'Janeiro fechado. O mês em que a maioria promete e desiste — e você não.', 'desafio', 0, 'ouro', 'mes-1',  201),
  ('fevereiro', 'Fevereiro', 'Fevereiro fechado. O mês mais curto do ano, e mesmo assim inteiro.',      'desafio', 0, 'ouro', 'mes-2',  202),
  ('marco',     'Março',     'Março fechado. Quando o ano deixa de ser novidade e vira rotina.',        'desafio', 0, 'ouro', 'mes-3',  203),
  ('abril',     'Abril',     'Abril fechado. Sem data comemorativa para segurar — só constância.',      'desafio', 0, 'ouro', 'mes-4',  204),
  ('maio',      'Maio',      'Maio fechado. O frio começa a servir de desculpa, e não serviu.',         'desafio', 0, 'ouro', 'mes-5',  205),
  ('junho',     'Junho',     'Junho fechado. Metade do ano, e você do lado certo da conta.',            'desafio', 0, 'ouro', 'mes-6',  206),
  ('julho',     'Julho',     'Julho fechado. Férias, viagem, rotina quebrada — e o treino aconteceu.',  'desafio', 0, 'ouro', 'mes-7',  207),
  ('agosto',    'Agosto',    'Agosto fechado. O mês mais longo de todos os que não têm feriado.',       'desafio', 0, 'ouro', 'mes-8',  208),
  ('outubro',   'Outubro',   'Outubro fechado. O ano começa a acabar, e você não afrouxou.',            'desafio', 0, 'ouro', 'mes-10', 210),
  ('novembro',  'Novembro',  'Novembro fechado. Um mês antes de todo mundo dizer "ano que vem".',       'desafio', 0, 'ouro', 'mes-11', 211),
  ('dezembro',  'Dezembro',  'Dezembro fechado. Ceia, férias e festa — e ainda assim os 20 minutos.',   'desafio', 0, 'ouro', 'mes-12', 212)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Setembro entra na mesma família
--
-- Ela nasceu antes desta ideia, com o emblema `sol` e um `threshold` de 25 que
-- nunca foi consultado. Alinhar agora é seguro porque ninguém a conquistou
-- ainda — o desafio só começa em 01/09. Depois de a primeira pessoa ganhar,
-- mudar o desenho de uma insígnia é mexer no que já é dela, e aí não se faz.
-- -----------------------------------------------------------------------------
update public.badges
   set emblem = 'mes-9',
       threshold = 0,
       sort_order = 209
 where slug = 'setembro'
   and not exists (select 1 from public.user_badges where badge_slug = 'setembro');

comment on column public.badges.threshold is
  'Número que concede a insígnia. Zero nas de métrica `desafio`: quem decide lá é challenges.goal.';
