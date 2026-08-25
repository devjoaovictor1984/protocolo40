-- =============================================================================
-- P20X · 0032 — Desafio de Setembro
--
-- O primeiro desafio do app. Existe para dar uma data a quem está esperando
-- "semana que vem" — que é a maioria de quem se cadastra e nunca começa.
--
-- A meta é 25 dias em 30, e não 30 em 30. Não é frouxidão: um desafio que quebra
-- na primeira gripe não é desafio, é armadilha. Quem falha no dia 4 de um
-- desafio perfeito abandona o mês inteiro; quem tem cinco dias de folga volta no
-- dia 5. A margem é o que faz o desafio sobreviver ao contato com a vida real —
-- e é a mesma ideia do dia de descanso, que já sustenta a sequência.
--
-- Para mudar isso, é uma linha: `goal`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A insígnia de quem terminar
--
-- Dourada, como o combinado: ouro fica reservado para o que é difícil e datado.
-- É do mês, não do acúmulo — quem ganhar esta em 2026 não ganha de novo.
-- -----------------------------------------------------------------------------
insert into public.badges (slug, name, description, metric, threshold, tier, emblem, sort_order)
values (
  'setembro',
  'Setembro',
  'Vinte e cinco dias de setembro com os seus 20 minutos. O mês em que deixou de ser tentativa.',
  'desafio',
  25,
  'ouro',
  'sol',
  200
)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- O desafio
-- -----------------------------------------------------------------------------
insert into public.challenges (
  slug, title, tagline, description, starts_on, ends_on, rule, goal, badge_slug, is_active, sort_order
)
values (
  'setembro-2026',
  'Desafio de Setembro',
  '20 minutos. Todos os dias.',
  E'Setembro tem trinta dias. É tempo suficiente para um hábito nascer e curto o bastante para você enxergar o fim daqui de onde está.

A regra é uma só: vinte minutos, todos os dias. Não precisa ser bonito, não precisa ser no mesmo horário, não precisa ser o mesmo treino. Precisa acontecer.

Cinco dias podem faltar. A vida acontece — gripe, viagem, plantão — e um desafio que quebra na primeira sexta-feira ruim não é desafio, é armadilha. Vinte e cinco dos trinta, e o mês é seu.

Ninguém aqui vê seu peso, sua medida ou sua foto. O ranking mostra uma coisa só: quantos dias você não deixou passar.',
  date '2026-09-01',
  date '2026-09-30',
  'dias_no_periodo',
  25,
  'setembro',
  true,
  10
)
on conflict (slug) do nothing;
