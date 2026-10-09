import { execFileSync } from 'node:child_process';
import { BACKEND_DIR, E2E_OWNER, testDatabaseUrl } from './env';

/** Deja la base de pruebas limpia y con la cuenta de la propietaria de prueba. */
export default function globalSetup(): void {
  execFileSync('npx', ['tsx', 'test/e2e-fixtures.ts'], {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl(),
      E2E_OWNER_EMAIL: E2E_OWNER.email,
      E2E_OWNER_NAME: E2E_OWNER.name,
      E2E_OWNER_PASSWORD: E2E_OWNER.password,
    },
  });
}
