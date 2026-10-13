import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import { expect, type Locator, type Page } from '@playwright/test';
import { BACKEND_DIR, testDatabaseUrl } from './env';

export async function login(page: Page, email: string, password: string) {
  await page.goto('/admin/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

/** En celular el menú lateral está oculto y se abre con el botón de la barra superior. */
export async function openNav(page: Page) {
  const toggle = page.getByRole('button', { name: 'Abrir navegación' });
  if (await toggle.isVisible()) await toggle.click();
}

export async function logout(page: Page) {
  await openNav(page);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
}

/**
 * Elige una opción de un Select (Radix) a partir de su etiqueta. `scope` acota la búsqueda de la
 * etiqueta cuando hay varios campos con el mismo nombre; las opciones se abren en la página.
 */
export async function pick(page: Page, label: string, option: string, scope?: Locator) {
  await (scope ?? page).getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/**
 * Simula que pasaron `hours` horas desde que se creó el pedido y ejecuta el ciclo de plazos
 * (avisos y cancelaciones automáticas) en la base de pruebas, con el backend compilado para e2e.
 */
export function advanceOrder(code: string, hours: number) {
  const options: ExecFileSyncOptions = {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl(), NODE_ENV: 'test', LOG_LEVEL: 'silent' },
  };
  execFileSync('npx', ['tsx', 'test/e2e-advance-order.ts', code, String(hours)], options);
  execFileSync('node', ['dist-e2e/cli/run-order-deadlines.js'], options);
}
