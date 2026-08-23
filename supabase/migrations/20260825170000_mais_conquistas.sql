-- =============================================================================
-- P20X · 0019 — mais conquistas
--
-- A escada de dias treinados sozinha premia só uma coisa. Estas medem o que o
-- app já sabe e que ninguém estava vendo: sequência sem quebrar, tempo
-- acumulado debaixo do relógio, volume por movimento, evidência em foto, e os
-- horários que dizem alguma coisa sobre a pessoa — treinar antes do sol ou não
-- tirar folga no fim de semana.
--
-- Nenhuma delas depende de dado novo: tudo sai de `workouts`,
-- `workout_exercises` e `progress_photos`.
-- =============================================================================

alter type public.badge_metric add value if not exists 'sequencia';
alter type public.badge_metric add value if not exists 'minutos';
alter type public.badge_metric add value if not exists 'agachamentos';
alter type public.badge_metric add value if not exists 'abdominais';
alter type public.badge_metric add value if not exists 'fotos';
alter type public.badge_metric add value if not exists 'madrugada';
alter type public.badge_metric add value if not exists 'fim_de_semana';
