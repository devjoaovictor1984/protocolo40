-- =============================================================================
-- P20X · 0027 — o perfil nasce público
--
-- O padrão anterior era privado, e a intenção estava certa: ninguém entra num
-- app de corpo e é listado sem pedir. Só que o efeito colateral era uma
-- comunidade que nascia invisível — todo mundo procurando e ninguém
-- aparecendo, porque cada pessoa precisava descobrir uma configuração antes de
-- existir para as outras.
--
-- A troca é deliberada e limitada ao que um perfil é: nome, @usuário, bio,
-- sequência, dias treinados e insígnias. O que este app tem de sensível de
-- verdade — peso, medidas, fotos e treinos — continua privado por padrão, com
-- as próprias configurações intocadas.
--
-- Sair da lista continua sendo um toque, em Comunidade ou em Privacidade.
-- =============================================================================

alter table public.user_settings
  alter column profile_visibility set default 'public',
  alter column streak_visibility set default 'public';

comment on column public.user_settings.profile_visibility is
  'Quem vê o perfil. Público por padrão: é o que faz a comunidade existir.';

-- -----------------------------------------------------------------------------
-- Quem já estava aqui
--
-- Alinhar as contas existentes é o que evita duas classes de usuário — as que
-- aparecem e as que não aparecem por um motivo que ninguém escolheu, apenas
-- pela data em que se cadastraram.
-- -----------------------------------------------------------------------------
update public.user_settings
   set profile_visibility = 'public',
       streak_visibility = 'public',
       allow_followers = true
 where profile_visibility = 'private';
