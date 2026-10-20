-- =============================================================================
-- P20X · desafios em grupo
--
-- Os três desafios sem açúcar (30, 60 e 90) entraram como três desafios de
-- marcação, e a tela de Hoje mostra um convite por tipo — o de maior ordem. A
-- pessoa caía direto no de 90 e nunca via que podia escolher.
--
-- `grupo` junta desafios que são o mesmo desafio em durações diferentes. Fora
-- dele (listas, Hoje) aparece um só, com o nome do grupo; dentro, a pessoa
-- escolhe a duração. Por baixo continuam três, cada um com sua meta, seu
-- ranking e sua medalha — misturar durações num ranking só não faz sentido.
--
-- É texto e é o nome que aparece na tela: um nome a mais para manter em
-- sincronia seria o primeiro a ficar diferente.
-- =============================================================================

alter table public.challenges
  add column if not exists grupo text;

alter table public.challenges
  add constraint challenge_grupo_preenchido check (grupo is null or length(btrim(grupo)) between 1 and 60);

comment on column public.challenges.grupo is
  'Nome do grupo de desafios que são o mesmo em durações diferentes. Fora do desafio aparece um só, com este nome; dentro, a pessoa escolhe a duração.';

update public.challenges
   set grupo = 'Sem açúcar'
 where slug in ('30-dias-sem-acucar', '60-dias-sem-acucar', '90-dias-sem-acucar');
