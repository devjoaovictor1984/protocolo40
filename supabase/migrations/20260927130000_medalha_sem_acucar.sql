-- =============================================================================
-- P20X · 0050 — a medalha do desafio sem açúcar
--
-- Ela nasceu com o emblema `muralha`, emprestado das conquistas de treino. Uma
-- medalha que não diz do que é não vale a pena ser buscada: agora é o cubo de
-- açúcar riscado (`sem-acucar`, desenhado em `features/badges/components/emblem.tsx`).
--
-- A descrição deixa de citar "dezoito em vinte e um": a meta é do desafio e o
-- admin pode mudá-la no painel. Um número escrito aqui ficaria mentindo no dia
-- em que ela mudasse.
-- =============================================================================

update public.badges
   set emblem      = 'sem-acucar',
       description = 'Venceu o desafio de 21 dias sem açúcar adicionado. A vontade passou a pedir licença.'
 where slug = 'sem-acucar';
