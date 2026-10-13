import { expect, test } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout, pick } from './helpers';

test('la propietaria configura contacto y pagos, y la tienda muestra el WhatsApp', async ({
  page,
}, testInfo) => {
  // Cada proyecto (celular, escritorio) usa un municipio distinto: comparten la base de pruebas.
  const municipality = testInfo.project.name === 'movil' ? 'Envigado' : 'Medellín';

  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/configuracion');
  await expect(page.getByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible();

  // Contacto: el WhatsApp se guarda con el código de país.
  await page.getByLabel('WhatsApp comercial').fill('300 123 4567');
  await page.getByRole('button', { name: 'Guardar contacto' }).click();
  await expect(page.getByText('Configuración guardada.')).toBeVisible();
  await expect(page.getByLabel('WhatsApp comercial')).toHaveValue('573001234567');

  // Nequi no se activa sin instrucciones.
  const nequi = page.getByRole('region', { name: 'Nequi' });
  await nequi.getByLabel('Instrucciones para el cliente').fill('');
  await nequi.getByRole('button', { name: 'Guardar' }).click();
  await nequi.getByRole('button', { name: 'Activar' }).click();
  await expect(
    page.getByText('Para activar Nequi escribe primero sus instrucciones de pago.'),
  ).toBeVisible();

  // Contra entrega: agrega un municipio de la lista oficial.
  const cod = page.getByRole('region', { name: 'Efectivo contra entrega' });
  await pick(page, 'Departamento', 'Antioquia', cod);
  await pick(page, 'Municipio', municipality, cod);
  await cod.getByRole('button', { name: 'Agregar municipio' }).click();
  await cod.getByRole('button', { name: 'Guardar municipios' }).click();
  await expect(page.getByText('Municipios guardados.')).toBeVisible();
  await expect(page.getByText(`${municipality}, Antioquia`)).toBeVisible();

  // La tienda muestra el enlace de WhatsApp en el pie.
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Escríbenos por WhatsApp' })).toHaveAttribute(
    'href',
    'https://wa.me/573001234567',
  );
});

test('el personal ve la configuración sin poder modificarla', async ({ page }, testInfo) => {
  const staff = {
    name: `Config ${testInfo.project.name}`,
    email: `config.${testInfo.project.name}@ejemplo.test`,
    password: 'clave-personal-123',
  };

  // La propietaria crea la cuenta por la API (la interfaz de cuentas ya se prueba aparte).
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const created = await page.request.post('/api/v1/admin/users', { data: staff });
  expect(created.ok()).toBe(true);
  await logout(page);

  await login(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/configuracion');
  await expect(
    page.getByText('Consulta de la configuración. Solo la propietaria puede modificarla.'),
  ).toBeVisible();
  await expect(page.getByLabel('WhatsApp comercial')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Guardar contacto' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Activar' })).toHaveCount(0);
});
