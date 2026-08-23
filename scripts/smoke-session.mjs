/**
 * Teste de ponta a ponta com sessão real.
 *
 * Cria um usuário, pega um token de verdade, monta o cookie no formato que o
 * @supabase/ssr espera e pede as páginas privadas ao servidor Next. Prova que o
 * proxy, o guard de sessão e os Server Components funcionam contra o Supabase
 * real — o que os testes de RLS, que falam direto com o banco, não cobrem.
 *
 * Precisa de um servidor rodando:
 *
 *   npm run build && npm start
 *   npm run test:smoke
 *
 * Contra um deploy: SMOKE_BASE_URL=https://seu-dominio npm run test:smoke
 *
 * O usuário de teste é removido no fim, inclusive quando alguma verificação falha.
 */

process.loadEnvFile('.env.local');

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REF = process.env.SUPABASE_PROJECT_REF;
const APP = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

const email = `e2e-${crypto.randomUUID()}@p20x.test`;
const password = `Teste-${crypto.randomUUID()}`;
let userId = '';

const admin = (path, init = {}) =>
  fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

function chunkCookie(name, value) {
  // o @supabase/ssr parte o cookie em .0, .1… quando passa de ~3180 chars
  const LIMIT = 3180;
  if (value.length <= LIMIT) return [[name, value]];

  const parts = [];
  for (let i = 0; i * LIMIT < value.length; i += 1) {
    parts.push([`${name}.${i}`, value.slice(i * LIMIT, (i + 1) * LIMIT)]);
  }
  return parts;
}

const results = [];
const check = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? 'OK  ' : 'FALHA'} ${label}${detail ? ` — ${detail}` : ''}`);
};

try {
  // ---- 1. cadastro
  const created = await admin('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = await created.json();
  userId = user.id;
  check('usuário criado pelo Auth', Boolean(userId));

  // ---- 2. o trigger provisionou perfil e configurações
  const profile = await admin(`/rest/v1/profiles?id=eq.${userId}&select=username,timezone,protocol_started_on`);
  const [row] = await profile.json();
  check('trigger criou o perfil', Boolean(row?.username), row?.username);
  check('fuso padrão aplicado', row?.timezone === 'America/Sao_Paulo', row?.timezone);

  const settings = await admin(`/rest/v1/user_settings?user_id=eq.${userId}&select=photos_visibility,daily_goal_seconds`);
  const [config] = await settings.json();
  check('foto nasce privada por padrão', config?.photos_visibility === 'private');
  check('meta diária de 20 minutos', config?.daily_goal_seconds === 1200);

  // ---- 3. sessão de verdade
  const tokenResponse = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await tokenResponse.json();
  check('login com e-mail e senha', Boolean(session.access_token));

  const cookieName = `sb-${REF}-auth-token`;
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
  const cookie = chunkCookie(cookieName, encoded)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

  const get = (path) =>
    fetch(`${APP}${path}`, { headers: { cookie }, redirect: 'manual' });

  // ---- 4. o onboarding barra quem ainda não completou o perfil
  const dashboard = await get('/app');
  check(
    'sem onboarding, /app manda para /onboarding',
    dashboard.status === 307 && (dashboard.headers.get('location') ?? '').includes('/onboarding'),
    `${dashboard.status} ${dashboard.headers.get('location') ?? ''}`,
  );

  const onboarding = await get('/onboarding');
  const onboardingHtml = await onboarding.text();
  check(
    'onboarding renderiza com sessão',
    onboarding.status === 200 && onboardingHtml.includes('Como podemos te chamar'),
  );

  // ---- 5. completa o onboarding e revisita as telas
  await admin(`/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ onboarding_completed_at: new Date().toISOString(), full_name: 'João Teste' }),
  });

  const app = await get('/app');
  const appHtml = await app.text();
  check('dashboard abre com sessão', app.status === 200);
  check('dashboard saúda o usuário', appHtml.includes('João'), appHtml.match(/Bom (dia|tarde|noite), \w+/)?.[0]);
  check('dashboard mostra a navegação', appHtml.includes('Histórico') && appHtml.includes('Evolução'));

  for (const path of ['/historico', '/calendario', '/evolucao', '/medidas', '/treinos', '/recordes', '/perfil', '/configuracoes/privacidade', '/treino/hoje']) {
    const page = await get(path);
    check(`${path} responde 200`, page.status === 200, page.status === 200 ? '' : String(page.status));
  }

  // ---- 6. perfil público continua invisível enquanto for privado
  const publicProfile = await fetch(`${APP}/u/${row.username}`, { redirect: 'manual' });
  check('perfil privado dá 404 para estranhos', publicProfile.status === 404, String(publicProfile.status));

  // ---- 7. torna público e confere que passa a aparecer
  await admin(`/rest/v1/user_settings?user_id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ profile_visibility: 'public' }),
  });

  const nowPublic = await fetch(`${APP}/u/${row.username}`, { redirect: 'manual' });
  const publicHtml = nowPublic.status === 200 ? await nowPublic.text() : '';
  check(
    'perfil público aparece depois de liberado',
    nowPublic.status === 200 && publicHtml.includes('João Teste'),
    String(nowPublic.status),
  );
} catch (error) {
  check('execução sem exceção', false, error instanceof Error ? error.message : String(error));
} finally {
  if (userId) {
    await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
    console.log('\n  usuário de teste removido');
  }
}

const falhas = results.filter((r) => !r.ok);
console.log(`\n${results.length - falhas.length}/${results.length} verificações passaram`);
process.exit(falhas.length === 0 ? 0 : 1);
