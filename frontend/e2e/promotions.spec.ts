import { expect, test } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout, openNav, pick } from './helpers';

test('la propietaria crea una promoción y la tienda muestra precio regular, descuento y final', async ({
  page,
}, testInfo) => {
  // Cada proyecto (celular, escritorio) usa sus propios datos: comparten la base de pruebas.
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const product = `Producto Promocion ${suffix}`;
  const staff = {
    name: `Ventas ${suffix}`,
    email: `ventas.${testInfo.project.name}@ejemplo.test`,
    password: 'clave-personal-123',
  };

  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const post = async (url: string, data: object) => {
    const res = await page.request.post(`/api/v1${url}`, { data });
    expect(res.ok()).toBe(true);
    return (await res.json()) as { id: string };
  };
  const brand = await post('/admin/brands', { name: `Marca Promocion ${suffix}` });
  const category = await post('/admin/categories', { name: `Categoría Promocion ${suffix}` });
  const created = await post('/admin/products', {
    name: product,
    description: 'Producto ficticio para pruebas.',
    brandId: brand.id,
    categoryId: category.id,
    basePrice: 40000,
  });
  await post(`/admin/products/${created.id}/variants`, {
    sku: `E2E-PROMO-${suffix.toUpperCase()}`,
    name: 'Tono Promocion',
  });
  const published = await page.request.patch(`/api/v1/admin/products/${created.id}/status`, {
    data: { status: 'ACTIVE' },
  });
  expect(published.ok()).toBe(true);
  await post('/admin/users', staff);

  // Fechas en la zona horaria del navegador, como las escribe el campo datetime-local.
  const [startsAt, endsAt] = await page.evaluate(() => {
    const local = (d: Date) =>
      new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    return [local(new Date(Date.now() - 3_600_000)), local(new Date(Date.now() + 86_400_000))];
  });

  // Crear la promoción desde el panel: 25 % al producto.
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Panel' })
    .getByRole('link', { name: 'Promociones' })
    .click();
  await expect(page.getByRole('heading', { name: 'Promociones', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Crear promoción' }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear promoción' });
  await dialog.getByLabel('Nombre').fill(`Promo ficticia ${suffix}`);
  await pick(page, 'Tipo', 'Porcentaje');
  await dialog.getByLabel('Valor').fill('25');
  await dialog.getByLabel('Inicio').fill(startsAt);
  await dialog.getByLabel('Fin').fill(endsAt);
  await dialog.getByRole('checkbox', { name: product }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Promoción creada.')).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(`Promo ficticia ${suffix}`) });
  await expect(row.getByText('Vigente')).toBeVisible();
  await logout(page);

  // El personal no ve ni abre promociones.
  await login(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('link', { name: 'Promociones' })).toHaveCount(0);
  await page.goto('/admin/promociones');
  await expect(page).toHaveURL(/\/admin$/);
  await logout(page);

  // La tienda: 40.000 → 30.000, −25 %.
  const slug = product.toLowerCase().replace(/\s+/g, '-');
  await page.goto(`/producto/${slug}`);
  await expect(page.getByText('−25%')).toBeVisible();
  await expect(page.getByText(/^\$\s30\.000$/)).toBeVisible();
  await expect(page.locator('del', { hasText: '40.000' })).toBeVisible();
  await expect(page.getByText(/Ahorras \$\s?10\.000/)).toBeVisible();

  await page.goto(`/productos?q=${encodeURIComponent(product)}`);
  const card = page.getByRole('article').filter({ hasText: product });
  await expect(card.getByText('−25%')).toBeVisible();
  await expect(card.locator('del', { hasText: '40.000' })).toBeVisible();
});
