-- =============================================================================
-- P20X · 0049 — o que conta como açúcar
--
-- O texto dizia "doce, refrigerante, açúcar no café" e parava ali. Mel,
-- mascavo e adoçante são as três primeiras dúvidas de quem começa, e sem
-- resposta cada um inventa a sua regra — uns frouxa demais, outros apertada
-- demais. O parágrafo passa a responder as três.
--
-- Troca só o parágrafo da definição. O resto do texto fica como o admin deixou.
-- =============================================================================

update public.challenges
   set description = replace(
         description,
         'Conta como açúcar adicionado: doce, refrigerante, suco de caixinha, açúcar no café, bolo, biscoito recheado. Não conta: fruta, leite, iogurte natural. Na dúvida, leia o rótulo — se tem açúcar entre os primeiros ingredientes, é açúcar.',
         'Conta como açúcar adicionado: doce, refrigerante, suco de caixinha, açúcar no café, bolo, biscoito recheado — e também mel, mascavo, demerara e xarope. Não conta: fruta, leite, iogurte natural e adoçante. Na dúvida, leia o rótulo — se tem açúcar entre os primeiros ingredientes, é açúcar.'
       )
 where slug = '21-dias-sem-acucar';
