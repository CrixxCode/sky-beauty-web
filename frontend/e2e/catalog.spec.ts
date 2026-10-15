import { expect, test, type Page } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout, pick } from './helpers';

// PNG de 1×1 píxel: basta para probar la carga de fotos.
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Busca en la tienda con el buscador visible (el del encabezado cambia entre celular y escritorio). */
async function searchStore(page: Page, text: string) {
  const input = page.getByRole('searchbox', { name: 'Buscar productos' }).locator('visible=true').first();
  await input.fill(text);
  await input.press('Enter');
}

test('la propietaria publica un producto con variante y foto, y el cliente lo encuentra', async ({
  page,
}, testInfo) => {
  // Cada proyecto (celular, escritorio) usa sus propios nombres: comparten la base de pruebas.
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const brand = `Marca Ficticia ${suffix}`;
  const parent = `Categoría Ficticia ${suffix}`;
  const sub = `Subcategoría Ficticia ${suffix}`;
  const product = `Labial Rubí Prueba ${suffix}`;

  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);

  // Marca y categorías por la API (sus pantallas no son el objeto de esta prueba).
  const brandRes = await page.request.post('/api/v1/admin/brands', { data: { name: brand } });
  expect(brandRes.ok()).toBe(true);
  const parentRes = await page.request.post('/api/v1/admin/categories', { data: { name: parent } });
  expect(parentRes.ok()).toBe(true);
  const { id: parentId } = (await parentRes.json()) as { id: string };
  const subRes = await page.request.post('/api/v1/admin/categories', {
    data: { name: sub, parentId },
  });
  expect(subRes.ok()).toBe(true);

  // Crear el producto desde el panel.
  await page.goto('/admin/productos');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await page.getByLabel('Nombre del producto *').fill(product);
  await pick(page, 'Marca *', brand);
  await pick(page, 'Categoría *', `${parent} > ${sub}`);
  await page.getByLabel('Precio base en COP *').fill('10000');
  await page.getByLabel('Descripción detallada *').fill('Producto ficticio para pruebas.');
  await page.getByRole('button', { name: 'Crear producto (Borrador)' }).click();
  await expect(page.getByText('Producto creado como borrador.')).toBeVisible();

  // Variante.
  await page.getByRole('button', { name: 'Agregar primera variante' }).click();
  await page.getByLabel('SKU (Identificador único) *').fill(`E2E-RUBI-${suffix.toUpperCase()}`);
  await page.getByLabel('Nombre o tono *').fill('Tono Ficticio');
  await page.getByRole('button', { name: 'Crear variante' }).click();
  await expect(page.getByRole('cell', { name: /Tono Ficticio/ }).first()).toBeVisible();

  // Foto general.
  await page.getByRole('tab', { name: /^Fotos/ }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: PIXEL_PNG,
  });
  await page.getByRole('button', { name: 'Subir foto' }).click();
  await expect(page.getByRole('tab', { name: 'Fotos (1)' })).toBeVisible();

  // Publicar.
  await page.getByRole('tab', { name: 'Estado y publicación' }).click();
  await page.getByRole('button', { name: 'Publicar / Activar en tienda' }).click();
  await expect(
    page.getByText('Este producto está publicado y visible para los clientes en la tienda online.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await logout(page);

  // El cliente lo encuentra por categoría (la principal incluye la subcategoría)...
  await page.goto('/productos');
  await page.getByRole('link', { name: parent, exact: true }).locator('visible=true').first().click();
  await expect(page.getByRole('heading', { name: product })).toBeVisible();

  // ...por marca...
  await page.goto('/productos');
  // En celular los filtros están en el panel "Filtros".
  const filters = page.getByRole('button', { name: 'Filtros' });
  if (await filters.isVisible()) await filters.click();
  await page.getByRole('link', { name: brand, exact: true }).locator('visible=true').first().click();
  await expect(page.getByRole('heading', { name: product })).toBeVisible();

  // ...y buscando sin tildes ni mayúsculas.
  await page.goto('/');
  await searchStore(page, `labial rubi prueba ${suffix.toLowerCase()}`);
  await expect(page).toHaveURL(/\/productos\?q=/);
  await expect(page.getByText('1 producto encontrado')).toBeVisible();

  // Detalle: variante, foto y "Agotado" (aún no tiene existencias).
  await page.getByRole('link', { name: product, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: product, level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tono Ficticio/ })).toBeVisible();
  const photo = page.getByRole('img', { name: product }).first();
  await expect(photo).toBeVisible();
  // La foto se sirve desde el dominio de la tienda (Next.js reenvía /uploads al backend).
  await expect(photo).toHaveAttribute('src', /^\/uploads\//);
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => (img.complete ? img.naturalWidth : 0)))
    .toBeGreaterThan(0);
  await expect(page.getByText('Esta variante no está disponible.')).toBeVisible();
});
