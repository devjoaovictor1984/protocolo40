import '@testing-library/jest-dom/vitest';

// Os testes de integração precisam das credenciais reais do projeto.
// Node 24 lê o arquivo direto; se não existir, os testes de integração se
// declaram pulados em vez de falhar.
try {
  process.loadEnvFile('.env.local');
} catch {
  // sem .env.local: só os testes unitários rodam
}
