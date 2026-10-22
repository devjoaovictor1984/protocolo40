#!/usr/bin/env node
/**
 * Modelos dos e-mails do Auth do Supabase, em português e com a marca.
 *
 * O painel do Supabase guarda esses textos em inglês por padrão, e editar lá à
 * mão não deixa rastro: o próximo que mexer não sabe o que estava escrito nem
 * por quê. Aqui eles são versionados e aplicados pela Management API.
 *
 *   node scripts/emails.mjs            gera as prévias em HTML (não muda nada)
 *   node scripts/emails.mjs --aplicar  grava assunto e corpo no projeto
 *
 * Precisa de SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF no .env.local.
 *
 * Os links apontam para `/auth/callback` com `token_hash`, não para o
 * `{{ .ConfirmationURL }}`. O padrão do Supabase cai no fluxo PKCE, cujo `code`
 * só vale no navegador que pediu: quem pede a senha no computador e abre o
 * e-mail no celular recebe `erro=sessao`. O `token_hash` vale em qualquer
 * aparelho, e o callback confere com `verifyOtp`.
 *
 * E-mail não é página: nada de CSS externo, flexbox ou variável. Tabela e
 * estilo inline, que é o que o Gmail e o Outlook entendem. A logo é PNG porque
 * o Outlook não abre WebP, e o texto não depende dela — imagem bloqueada
 * continua mostrando "P20X" no `alt`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cor = {
  fundo: '#F3F4F6',
  cartao: '#FFFFFF',
  marca: '#0A0C0B',
  texto: '#11161F',
  apagado: '#5E646C',
  borda: '#E3E5E8',
  botao: '#D33C33',
};

const fonte = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Link que o callback troca por sessão em qualquer aparelho. */
const link = (type, next) =>
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=${type}&next=${encodeURIComponent(next)}`;

const paragrafo = (texto) =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${cor.texto};">${texto}</p>`;

const botao = (href, rotulo) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td style="border-radius:10px;background:${cor.botao};">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${fonte};font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:10px;">${rotulo}</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:${cor.apagado};">
  O botão não abriu? Copie e cole este endereço no navegador:<br>
  <a href="${href}" style="color:${cor.apagado};word-break:break-all;">${href}</a>
</p>`;

const codigo = (valor) => `
<p style="margin:8px 0 24px;font-family:'SFMono-Regular', Consolas, 'Liberation Mono', monospace;font-size:32px;font-weight:700;letter-spacing:6px;color:${cor.texto};">${valor}</p>`;

const aviso = (texto) =>
  `<p style="margin:0;padding-top:16px;border-top:1px solid ${cor.borda};font-size:13px;line-height:20px;color:${cor.apagado};">${texto}</p>`;

/** Moldura comum: faixa escura com a logo, cartão branco, rodapé. */
const moldura = ({ previa, titulo, corpo }) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:${cor.fundo};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${previa}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${cor.fundo};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${fonte};">
        <tr>
          <td style="background:${cor.marca};border-radius:14px 14px 0 0;padding:24px 32px;">
            <img src="{{ .SiteURL }}/marca/logo-email.png" width="160" height="34" alt="P20X" style="display:block;border:0;width:160px;height:34px;color:#FFFFFF;font-size:24px;font-weight:800;">
          </td>
        </tr>
        <tr>
          <td style="background:${cor.cartao};border-radius:0 0 14px 14px;padding:32px;">
            <h1 style="margin:0 0 16px;font-size:24px;line-height:32px;font-weight:800;color:${cor.texto};">${titulo}</h1>
            ${corpo}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 16px 0;font-size:12px;line-height:18px;color:${cor.apagado};">
            <strong style="color:${cor.texto};">P20X</strong> · 20 minutos. Todos os dias.<br>
            Este e-mail foi enviado para {{ .Email }} porque esse endereço foi usado no P20X.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

/**
 * Um modelo por e-mail que o Auth manda. A chave é o sufixo do campo na API:
 * `mailer_subjects_<chave>` e `mailer_templates_<chave>_content`.
 */
const modelos = {
  recovery: {
    assunto: 'Crie uma nova senha no P20X',
    previa: 'O link vale por 1 hora.',
    titulo: 'Vamos criar uma senha nova',
    corpo: () =>
      paragrafo('Recebemos um pedido para trocar a senha da sua conta. Toque no botão para escolher a nova.') +
      botao(link('recovery', '/redefinir-senha'), 'Criar nova senha') +
      aviso('O link vale por 1 hora e só funciona uma vez. Se não foi você que pediu, pode ignorar este e-mail: sua senha continua a mesma.'),
  },
  confirmation: {
    assunto: 'Confirme seu e-mail no P20X',
    previa: 'Falta um toque para começar.',
    titulo: 'Falta um passo',
    corpo: () =>
      paragrafo('Confirme que este e-mail é seu para terminar o cadastro e montar seu primeiro treino.') +
      botao(link('email', '/onboarding'), 'Confirmar e-mail') +
      aviso('Se você não criou uma conta no P20X, pode ignorar este e-mail. Nenhuma conta será ativada.'),
  },
  magic_link: {
    assunto: 'Seu link para entrar no P20X',
    previa: 'Entre sem digitar senha.',
    titulo: 'Seu link de acesso',
    corpo: () =>
      paragrafo('Toque no botão para entrar na sua conta.') +
      botao(link('magiclink', '/hoje'), 'Entrar no P20X') +
      aviso('O link vale por 1 hora e só funciona uma vez. Se não foi você que pediu, pode ignorar este e-mail.'),
  },
  email_change: {
    assunto: 'Confirme seu novo e-mail no P20X',
    previa: 'Confirme a troca de endereço.',
    titulo: 'Confirme o novo endereço',
    corpo: () =>
      paragrafo('Recebemos um pedido para trocar o e-mail da sua conta de {{ .Email }} para {{ .NewEmail }}.') +
      botao(link('email_change', '/configuracoes'), 'Confirmar troca') +
      aviso('Se não foi você que pediu, ignore este e-mail e troque sua senha em Configurações.'),
  },
  invite: {
    assunto: 'Seu convite para o P20X',
    previa: '20 minutos por dia, a partir de hoje.',
    titulo: 'Seu convite chegou',
    corpo: () =>
      paragrafo('Alguém te chamou para treinar no P20X: 20 minutos por dia, sem academia e no seu ritmo.') +
      botao(link('invite', '/onboarding'), 'Aceitar convite') +
      aviso('Se você não esperava este convite, pode ignorar este e-mail.'),
  },
  reauthentication: {
    assunto: 'Seu código de verificação do P20X',
    previa: 'Use o código para confirmar que é você.',
    titulo: 'Seu código de verificação',
    corpo: () =>
      paragrafo('Use este código para confirmar que é você:') +
      codigo('{{ .Token }}') +
      aviso('O código vale por 1 hora. Se não foi você que pediu, troque sua senha em Configurações.'),
  },
};

const html = Object.fromEntries(
  Object.entries(modelos).map(([chave, m]) => [chave, moldura({ ...m, corpo: m.corpo() })]),
);

if (!process.argv.includes('--aplicar')) {
  // prévia com valores de exemplo no lugar das variáveis do Supabase
  const exemplo = {
    SiteURL: 'https://www.p20x.com.br',
    TokenHash: 'exemplo',
    Token: '12345678',
    Email: 'voce@exemplo.com',
    NewEmail: 'novo@exemplo.com',
  };
  const dir = join(tmpdir(), 'p20x-emails');
  mkdirSync(dir, { recursive: true });
  for (const [chave, conteudo] of Object.entries(html)) {
    const arquivo = join(dir, `${chave}.html`);
    writeFileSync(arquivo, conteudo.replace(/\{\{ \.(\w+) \}\}/g, (_, v) => exemplo[v] ?? v));
    console.log(`${modelos[chave].assunto.padEnd(40)} ${arquivo}`);
  }
  console.log('\nNada foi alterado no Supabase. Para gravar: node scripts/emails.mjs --aplicar');
  process.exit(0);
}

process.loadEnvFile('.env.local');

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;

if (!token || !ref) {
  console.error(
    'Faltam SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF no .env.local.\n' +
      'O token se cria em https://supabase.com/dashboard/account/tokens',
  );
  process.exit(1);
}

const config = {};
for (const [chave, m] of Object.entries(modelos)) {
  config[`mailer_subjects_${chave}`] = m.assunto;
  config[`mailer_templates_${chave}_content`] = html[chave];
}

const resposta = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(config),
});

if (!resposta.ok) {
  console.error(`O Supabase recusou (${resposta.status}): ${await resposta.text()}`);
  process.exit(1);
}

const resultado = await resposta.json();
for (const chave of Object.keys(modelos)) {
  const ok = resultado[`mailer_subjects_${chave}`] === modelos[chave].assunto;
  console.log(`${ok ? 'gravado ' : 'DIFERENTE'}  ${chave.padEnd(18)} ${resultado[`mailer_subjects_${chave}`]}`);
}
