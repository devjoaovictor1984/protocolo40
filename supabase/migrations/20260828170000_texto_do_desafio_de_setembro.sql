-- =============================================================================
-- P20X · 0041 — o texto do Desafio de Setembro, mais curto
--
-- O primeiro texto explicava demais. Quatro parágrafos, frases longas e um tom
-- de aula — quem abre a tela quer decidir se entra, não ler um manifesto. Este
-- diz a mesma coisa em menos da metade, com a frase mais importante isolada.
--
-- O que foi mantido, porque é o que convence: a margem dos cinco dias (a razão
-- de o desafio sobreviver a uma gripe) e a promessa de privacidade (o ranking
-- mostra dias, não corpo).
--
-- Migration em vez de edição direta: o seed original fica valendo para uma
-- instalação nova, e produção recebe o texto corrigido pelo mesmo caminho de
-- sempre. Depois disso, o texto é editável em `/admin/desafios` sem deploy.
-- =============================================================================

update public.challenges
   set description =
E'Trinta dias. Vinte minutos por dia.

Não precisa ser bonito. Não precisa ser no mesmo horário. Não precisa ser o mesmo treino. Precisa acontecer.

A meta é vinte e cinco dos trinta. Os cinco que sobram são seus — gripe, viagem, plantão. Um desafio que quebra na primeira sexta-feira ruim não é desafio, é armadilha.

Começa numa terça, dia 1º. Entre antes e comece junto com todo mundo.

No ranking aparece uma coisa só: quantos dias você não deixou passar. Peso, medida e foto continuam seus.'
 where slug = 'setembro-2026';
