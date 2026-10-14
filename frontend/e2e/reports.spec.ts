import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout, openNav } from './helpers';

test('la propietaria ve la venta pagada en los reportes y exporta el CSV; el personal no tiene acceso', async ({
  page,
}, testInfo) => {
  // Cada proyecto (celular, escritorio) usa sus propios datos: comparten la base de pruebas.
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const sku = `E2E-REPORTE-${suffix.toUpperCase()}`;
  const staff = {
    name: `Reportes ${suffix}`,
    email: `reportes.${testInfo.project.name}@ejemplo.test`,
    password: 'clave-personal-123',
  };

  // Datos: producto con costo de compra, un pedido confirmado y su pago verificado.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const api = async (method: 'post' | 'patch', url: string, data: object) => {
    const res = await page.request[method](`/api/v1${url}`, { data });
    expect(res.ok(), `${method} ${url}`).toBe(true);
    return (await res.json()) as Record<string, string>;
  };
  const brand = await api('post', '/admin/brands', { name: `Marca Reporte ${suffix}` });
  const category = await api('post', '/admin/categories', { name: `Categoría Reporte ${suffix}` });
  const product = await api('post', '/admin/products', {
    name: `Producto Reporte ${suffix}`,
    description: 'Producto ficticio para pruebas.',
    brandId: brand.id,
    categoryId: category.id,
    basePrice: 10000,
  });
  const variant = await api('post', `/admin/products/${product.id}/variants`, {
    sku,
    name: `Tono Reporte ${suffix}`,
    costPrice: 6000,
  });
  await api('post', '/admin/inventory/movements', {
    variantId: variant.id,
    type: 'INITIAL',
    quantity: 5,
  });
  await api('patch', `/admin/products/${product.id}/status`, { status: 'ACTIVE' });
  const methods = (await (
    await page.request.get('/api/v1/admin/payment-methods')
  ).json()) as Array<{ id: string; code: string }>;
  const transfer = methods.find((m) => m.code === 'BANK_TRANSFER');
  if (!transfer) throw new Error('Falta el método de transferencia.');
  await api('patch', `/admin/payment-methods/${transfer.id}`, {
    isActive: true,
    instructions: 'Instrucciones ficticias de pago.',
  });
  await api('post', '/admin/users', staff);
  const order = await api('post', '/store/orders', {
    items: [{ variantId: variant.id, quantity: 2 }],
    municipalityCode: '05001',
    customerName: `Cliente Reporte ${suffix}`,
    customerPhone: '3001112233',
    addressLine: 'Dirección ficticia 123',
    paymentMethodId: transfer.id,
    idempotencyKey: `e2e-reporte-${suffix}-${Date.now()}`,
    termsAccepted: true,
    dataProcessingAccepted: true,
  });
  await api('patch', `/admin/orders/${order.id}/confirm`, { shippingCost: 5000 });
  await api('patch', `/admin/orders/${order.id}/payment-received`, {});
  await api('patch', `/admin/orders/${order.id}/payment/verify`, {});

  // Reportes: por defecto los últimos 30 días, que incluyen el pedido de hoy.
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Panel' })
    .getByRole('link', { name: 'Reportes' })
    .click();
  await expect(page.getByRole('heading', { name: 'Reportes', level: 1 })).toBeVisible();
  await expect(page.getByText('Total vendido')).toBeVisible();

  await page.getByRole('tab', { name: 'Más vendidos' }).click();
  const topRow = page.getByRole('row', { name: new RegExp(sku) });
  await expect(topRow).toContainText(`Producto Reporte ${suffix}`);
  await expect(topRow.getByRole('cell').nth(3)).toHaveText('2');
  await expect(topRow).toContainText('20.000');

  // Ganancia: 2 × (10.000 − 6.000) = 8.000, margen del 40 %.
  await page.getByRole('tab', { name: 'Márgenes' }).click();
  const marginRow = page.getByRole('row', { name: new RegExp(sku) });
  await expect(marginRow).toContainText('12.000');
  await expect(marginRow).toContainText('8.000');
  await expect(marginRow).toContainText('40 %');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^margenes_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain(
    `Producto Reporte ${suffix};Tono Reporte ${suffix};${sku};2;20000;12000;8000;40`,
  );
  await logout(page);

  // El personal no ve ni abre los reportes.
  await login(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('link', { name: 'Reportes' })).toHaveCount(0);
  await page.goto('/admin/reportes');
  await expect(page).toHaveURL(/\/admin$/);
});
