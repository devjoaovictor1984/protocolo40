-- =============================================================================
-- P20X · 0045 — a métrica "trilha" para as insígnias
--
-- Arquivo próprio pela mesma razão de 0031: um valor novo de enum não pode ser
-- USADO na mesma transação em que é criado, e o CLI roda cada migration numa
-- transação. Junto do seed que o usa, falharia com
-- "unsafe use of new value of enum type".
--
-- A métrica separa a insígnia de trilha das outras três famílias: acúmulo
-- (dias, flexões), desafio (datado, não volta) e fundador. Trilha é conclusão
-- de programa: não tem data marcada como o desafio, e não acumula como os dias.
-- =============================================================================

alter type public.badge_metric add value if not exists 'trilha';
