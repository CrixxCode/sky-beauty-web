import { expect, test, type Page } from '@playwright/test';
import { E2E_OWNER } from './env';

async function login(page: Page, email: string, password: string) {
  await page.goto('/admin/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

/** En celular el menú lateral está oculto y se abre con el botón de la barra superior. */
async function openNav(page: Page) {
  const toggle = page.getByRole('button', { name: 'Abrir navegación' });
  if (await toggle.isVisible()) await toggle.click();
}

async function logout(page: Page) {
  await openNav(page);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
}

test('el panel exige iniciar sesión', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Panel de gestión Sky Beauty' })).toBeVisible();
});

test('muestra un error con credenciales incorrectas', async ({ page }) => {
  await login(page, E2E_OWNER.email, 'clave-incorrecta-123');
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('la propietaria crea una cuenta del personal, que solo ve lo permitido', async ({
  page,
}, testInfo) => {
  const staff = {
    name: `Personal ${testInfo.project.name}`,
    email: `personal.${testInfo.project.name}@ejemplo.test`,
    password: 'clave-personal-123',
  };

  // La propietaria inicia sesión y ve el estado del servidor.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible();
  await expect(page.getByText(`Hola, ${E2E_OWNER.name}.`)).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Servidor y base de datos conectados');

  // Crea la cuenta del personal desde el menú lateral.
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Panel' })
    .getByRole('link', { name: 'Cuentas' })
    .click();
  await expect(page.getByRole('heading', { name: 'Cuentas', level: 1 })).toBeVisible();
  await page.getByLabel('Nombre').fill(staff.name);
  await page.getByLabel('Correo').fill(staff.email);
  await page.getByLabel('Contraseña inicial').fill(staff.password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Cuenta del personal creada.')).toBeVisible();
  await expect(page.getByText(staff.email)).toBeVisible();
  await logout(page);

  // El personal entra, no ve "Cuentas" y no puede abrirla por URL.
  await login(page, staff.email, staff.password);
  await expect(page.getByText(`Hola, ${staff.name}.`)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cuentas' })).toHaveCount(0);
  await page.goto('/admin/cuentas');
  await expect(page).toHaveURL(/\/admin$/);
  await logout(page);

  // Tras cerrar sesión, el panel vuelve a pedir inicio de sesión.
  await page.goto('/admin/mi-cuenta');
  await expect(page).toHaveURL(/\/admin\/login$/);
});
