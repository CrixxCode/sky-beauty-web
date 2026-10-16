// Aplica las migraciones a la base de pruebas (TEST_DATABASE_URL). Uso: npm run test:db:prepare
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { assertTestDatabaseUrl } from '../src/shared/security/test-database-url';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertTestDatabaseUrl(testDatabaseUrl);
if (!testDatabaseUrl) {
  console.error('TEST_DATABASE_URL no está definida.');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
});
process.exit(result.status ?? 1);
