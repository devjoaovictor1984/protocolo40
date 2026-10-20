-- =============================================================================
-- P20X · sem açúcar: 30, 60 e 90 dias
--
-- O pedido: "o desafio 30 dias sem açúcar, onde a pessoa pode ativá-lo quando
-- quiser. No caso, 30, 60 e 90."
--
-- Nada de estrutura nova: o desafio de marcação (`kind = 'alimentacao'`) e o
-- início pessoal (`duration_days`) já existem desde o de 21 dias. São três
-- desafios, e não um com três durações, porque meta, ranking e medalha moram
-- no desafio — um só, com durações misturadas, poria no mesmo ranking quem
-- está no dia 25 de 30 e quem está no dia 25 de 90.
--
-- Decisões:
--
-- 1. **Começa quando quiser.** Abertos de hoje em diante, sem data de fechar;
--    o trigger `conferir_inicio_no_desafio` aceita hoje até 30 dias à frente.
-- 2. **Um dia por semana pode escapar.** 26 de 30, 52 de 60, 78 de 90 — a
--    mesma folga do de 21 (18 de 21). Um aniversário não pode ser o fim.
-- 3. **Nascem ligados.** O de 21 nasceu desligado porque o texto era proposta;
--    estes foram pedidos para ir ao ar. O admin desliga no painel se quiser.
-- 4. **Uma medalha para cada**, com o cubo de açúcar riscado e metal que sobe
--    com a duração. A descrição não cita a meta: o admin pode mudá-la.
-- =============================================================================

insert into public.badges (slug, name, description, metric, threshold, tier, emblem, sort_order)
values
  ('sem-acucar-30', 'Sem açúcar · 30 dias',
   'Venceu o desafio de 30 dias sem açúcar adicionado. Um mês inteiro em que a vontade pediu licença.',
   'desafio', 26, 'prata', 'sem-acucar', 301),
  ('sem-acucar-60', 'Sem açúcar · 60 dias',
   'Venceu o desafio de 60 dias sem açúcar adicionado. O paladar já é outro.',
   'desafio', 52, 'ouro', 'sem-acucar', 302),
  ('sem-acucar-90', 'Sem açúcar · 90 dias',
   'Venceu o desafio de 90 dias sem açúcar adicionado. Já não é desafio: é como você come.',
   'desafio', 78, 'imperial', 'sem-acucar', 303)
on conflict (slug) do nothing;

insert into public.challenges (
  slug, title, tagline, description, starts_on, ends_on, rule, goal, badge_slug,
  is_active, sort_order, kind, duration_days
)
select
  v.slug, v.title, v.tagline,
  format(
    E'%s dias sem açúcar adicionado. Não é dieta e não tem cardápio: é uma coisa só, por %s, para você ver o que muda quando ela sai.

Conta como açúcar adicionado: doce, refrigerante, suco de caixinha, açúcar no café, bolo, biscoito recheado — e também mel, mascavo, demerara e xarope. Não conta: fruta, leite, iogurte natural e adoçante. Na dúvida, leia o rótulo — se tem açúcar entre os primeiros ingredientes, é açúcar.

Você escolhe o dia de começar. Venceu o dia? Marque. Pode marcar hoje ou, se esquecer, amanhã. Escorregou? Não marque e siga. Nada zera: o dia seguinte começa limpo.

Um dia por semana pode escapar. %s dos %s, e o desafio é seu.

Ninguém aqui vê o que você comeu. O ranking mostra uma coisa só: quantos dias você venceu.',
    v.duracao, v.periodo, v.meta, v.duracao
  ),
  date '2026-10-19',
  date '2099-12-31',
  'dias_no_periodo',
  v.meta,
  v.badge,
  true,
  v.ordem,
  'alimentacao',
  v.duracao
from (values
  ('30-dias-sem-acucar', '30 dias sem açúcar', 'Um mês. Um dia de cada vez.',          30, 'um mês',      26, 'sem-acucar-30', 6),
  ('60-dias-sem-acucar', '60 dias sem açúcar', 'Dois meses para o paladar mudar.',     60, 'dois meses',  52, 'sem-acucar-60', 7),
  ('90-dias-sem-acucar', '90 dias sem açúcar', 'Três meses. Aí já é jeito de comer.',  90, 'três meses',  78, 'sem-acucar-90', 8)
) as v(slug, title, tagline, duracao, periodo, meta, badge, ordem)
on conflict (slug) do nothing;
