-- =============================================================================
-- P20X · 0042 — quebras de linha do texto do desafio
--
-- A migration que corrigiu o texto foi salva num editor do Windows, e a string
-- multilinha carregou os `\r\n` do arquivo para dentro do banco. O componente
-- separava parágrafos em `\n\n`, que não casa com `\r\n\r\n` — a sequência é
-- `\r \n \r \n` e não tem dois `\n` seguidos.
--
-- Efeito: o texto inteiro virava um parágrafo só. Sem erro, sem aviso, só feio.
--
-- Não é caso isolado: **textarea de HTML envia CRLF por especificação**, então
-- todo desafio criado pelo painel teria o mesmo problema. A ação de salvar
-- passou a normalizar na entrada, e o componente passou a aceitar as duas
-- convenções na saída. Esta migration limpa o que já está gravado.
-- =============================================================================

update public.challenges
   set description = replace(description, E'\r\n', E'\n')
 where description like '%' || E'\r' || '%';
