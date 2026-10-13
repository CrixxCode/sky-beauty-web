import { expect, test } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout, openNav, pick } from './helpers';

test('el personal registra entradas y ajustes, el historial cuadra y aparece el stock bajo', async ({
  page,
}, testInfo) => {
  // Cada proyecto (celular, escritorio) usa sus propios datos: comparten la base de pruebas.
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const product = `Producto Inventario ${suffix}`;
  const variant = `Tono Inventario ${suffix}`;
  const staff = {
    name: `Bodega ${suffix}`,
    email: `bodega.${testInfo.project.name}@ejemplo.test`,
    password: 'clave-personal-123',
  };

  // La propietaria prepara el producto y la cuenta del personal por la API.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const api = page.request;
  const post = async (url: string, data: object) => {
    const res = await api.post(`/api/v1${url}`, { data });
    expect(res.ok()).toBe(true);
    return (await res.json()) as { id: string };
  };
  const brand = await post('/admin/brands', { name: `Marca Inventario ${suffix}` });
  const category = await post('/admin/categories', { name: `Categoría Inventario ${suffix}` });
  const created = await post('/admin/products', {
    name: product,
    description: 'Producto ficticio para pruebas.',
    brandId: brand.id,
    categoryId: category.id,
    basePrice: 10000,
  });
  await post(`/admin/products/${created.id}/variants`, {
    sku: `E2E-INV-${suffix.toUpperCase()}`,
    name: variant,
    lowStockThreshold: 2,
  });
  await post('/admin/users', staff);
  await logout(page);

  // El personal registra los movimientos desde el panel.
  await login(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin$/);
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Panel' })
    .getByRole('link', { name: 'Inventario' })
    .click();
  await expect(page.getByRole('heading', { name: 'Inventario', level: 1 })).toBeVisible();

  const option = `${product} - ${variant}`;
  const register = async (type: string, quantity: string, note?: string) => {
    await pick(page, 'Variante', option);
    await pick(page, 'Tipo de movimiento', type);
    await page.getByLabel('Cantidad').fill(quantity);
    if (note) await page.getByLabel(/Justificación|Nota/).fill(note);
    await page.getByRole('button', { name: 'Registrar movimiento' }).click();
    await expect(page.getByText('Movimiento registrado.').last()).toBeVisible();
  };

  await register('Existencias iniciales', '5');
  await register('Compra a proveedor', '3', 'Factura ficticia 001');

  // El ajuste exige justificación.
  await pick(page, 'Tipo de movimiento', 'Ajuste manual');
  await page.getByLabel('Cantidad').fill('-6');
  await page.getByLabel('Justificación *').fill('');
  await expect(page.getByRole('button', { name: 'Registrar movimiento' })).toBeDisabled();
  await register('Ajuste manual', '-6', 'Conteo físico ficticio');

  // Stock: 5 + 3 - 6 = 2, en el umbral → stock bajo.
  await expect(page.getByText('Stock actual: 2 unidades')).toBeVisible();
  const history = page.getByRole('heading', { name: 'Historial reciente' }).locator('xpath=../..');
  await expect(history.getByText('5 → 8 un.')).toBeVisible();
  await expect(history.getByText('8 → 2 un.')).toBeVisible();
  await expect(history.getByText('Conteo físico ficticio')).toBeVisible();

  await page.getByRole('button', { name: 'Stock bajo' }).click();
  const row = page.getByRole('row', { name: new RegExp(product) });
  await expect(row).toBeVisible();
  await expect(row.getByText('Stock bajo')).toBeVisible();

  // La tienda muestra la variante como disponible cuando el producto se publica.
  await logout(page);
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const published = await api.patch(`/api/v1/admin/products/${created.id}/status`, {
    data: { status: 'ACTIVE' },
  });
  expect(published.ok()).toBe(true);
  await logout(page);
  const productPath = `/producto/${product.toLowerCase().replace(/\s+/g, '-')}`;
  await page.goto(productPath);
  await expect(page.getByText('Disponible.')).toBeVisible();
});
