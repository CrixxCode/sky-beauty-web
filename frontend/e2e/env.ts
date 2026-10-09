import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export const BACKEND_DIR = path.resolve(__dirname, '../../backend');
export const E2E_FRONTEND_PORT = 3100;
export const E2E_BACKEND_PORT = 4100;

/** Cuenta de la propietaria que se crea en la base de pruebas antes de cada ejecución. */
export const E2E_OWNER = {
  email: 'duena.e2e@ejemplo.test',
  name: 'Dueña E2E',
  password: 'clave-e2e-segura-123',
};

/** URL de la base de pruebas, tomada de backend/.env (TEST_DATABASE_URL). */
export function testDatabaseUrl(): string {
  const env = parseEnv(readFileSync(path.join(BACKEND_DIR, '.env'), 'utf8'));
  const url = env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL no está definida en backend/.env.');
  return url;
}
