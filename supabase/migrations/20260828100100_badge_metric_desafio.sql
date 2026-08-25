-- =============================================================================
-- P20X · 0031 — a métrica "desafio" para as insígnias
--
-- Arquivo próprio, e não junto do seed, por uma regra do Postgres: um valor novo
-- de enum não pode ser USADO na mesma transação em que é criado. Como o CLI roda
-- cada migration numa transação, juntar as duas coisas falharia com
-- "unsafe use of new value of enum type".
--
-- A métrica separa duas coisas que se pareciam: insígnia de acúmulo (dias
-- treinados, flexões somadas) e insígnia de desafio, que é datada e não volta.
-- =============================================================================

alter type public.badge_metric add value if not exists 'desafio';
