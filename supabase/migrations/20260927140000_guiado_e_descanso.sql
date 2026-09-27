-- =============================================================================
-- P20X · 0051 — o treino guiado e o dia de descanso da trilha
--
-- Dois valores novos de enum, sozinhos neste arquivo: `alter type ... add value`
-- não pode ser usado na mesma transação em que foi criado, e o script de
-- migrations roda cada arquivo numa transação. O programa que usa os dois vem
-- no arquivo seguinte.
--
-- - `guiado`: o treino que conduz passo a passo — "10 polichinelos, descanso,
--   5 agachamentos, descanso". O `amrap` mostra o circuito e deixa a pessoa
--   repetir no próprio ritmo; para quem nunca treinou, isso é uma lista, não
--   uma aula.
-- - `descanso`: a sessão da trilha que é folga. A trilha do novato tem seis
--   dias de treino e um de descanso por semana.
-- =============================================================================

alter type public.workout_method add value if not exists 'guiado';
alter type public.track_focus add value if not exists 'descanso';
