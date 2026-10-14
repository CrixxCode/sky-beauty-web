// Configuración compartida por los scripts de captura.
// Las credenciales del panel se leen de backend/.env en tiempo de ejecución y nunca se imprimen.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPO = path.resolve(ROOT, '..');

export const SITE = process.env.SITE_URL ?? 'http://localhost:3300';
export const API = process.env.API_URL ?? 'http://localhost:4000/api/v1';

function parseEnv(file) {
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

/** Cuenta del panel para la grabación: VIDEO_ADMIN_EMAIL/PASSWORD o la propietaria de desarrollo. */
export function adminCredentials() {
  if (process.env.VIDEO_ADMIN_EMAIL && process.env.VIDEO_ADMIN_PASSWORD) {
    return { email: process.env.VIDEO_ADMIN_EMAIL, password: process.env.VIDEO_ADMIN_PASSWORD };
  }
  const env = parseEnv(path.join(REPO, 'backend', '.env'));
  if (env.NODE_ENV === 'production') throw new Error('No se graba contra producción.');
  return { email: env.SEED_OWNER_EMAIL, password: env.SEED_OWNER_PASSWORD };
}

/** Inicia sesión en el panel por la API y devuelve el storageState para Playwright. */
export async function adminStorageState(browser) {
  const ctx = await browser.newContext({ baseURL: SITE });
  const { email, password } = adminCredentials();
  const res = await ctx.request.post(`${SITE}/api/v1/admin/auth/login`, { data: { email, password } });
  if (!res.ok()) throw new Error(`Inicio de sesión del panel: HTTP ${res.status()}`);
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}
