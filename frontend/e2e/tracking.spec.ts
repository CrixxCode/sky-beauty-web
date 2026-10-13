import { expect, test } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout } from './helpers';

test('el cliente sigue su pedido con el enlace privado y un enlace inválido no revela nada', async ({
  page,
}, testInfo) => {
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const productName = `Producto Seguimiento ${suffix}`;

  // Datos: producto con existencias, transferencia activa y dos pedidos de un cliente.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const api = async (method: 'post' | 'patch', url: string, data: object) => {
    const res = await page.request[method](`/api/v1${url}`, { data });
    expect(res.ok(), `${method} ${url}`).toBe(true);
    return (await res.json()) as Record<string, string>;
  };
  const brand = await api('post', '/admin/brands', { name: `Marca Seguimiento ${suffix}` });
  const category = await api('post', '/admin/categories', {
    name: `Categoría Seguimiento ${suffix}`,
  });
  const product = await api('post', '/admin/products', {
    name: productName,
    description: 'Producto ficticio para pruebas.',
    brandId: brand.id,
    categoryId: category.id,
    basePrice: 12000,
  });
  const variant = await api('post', `/admin/products/${product.id}/variants`, {
    sku: `E2E-SEG-${suffix.toUpperCase()}`,
    name: `Tono Seguimiento ${suffix}`,
  });
  await api('post', '/admin/inventory/movements', {
    variantId: variant.id,
    type: 'INITIAL',
    quantity: 5,
  });
  await api('patch', `/admin/products/${product.id}/status`, { status: 'ACTIVE' });
  const methods = (await (
    await page.request.get('/api/v1/admin/payment-methods')
  ).json()) as Array<{
    id: string;
    code: string;
  }>;
  const transfer = methods.find((m) => m.code === 'BANK_TRANSFER');
  if (!transfer) throw new Error('Falta el método de transferencia.');
  await api('patch', `/admin/payment-methods/${transfer.id}`, {
    isActive: true,
    instructions: 'Instrucciones ficticias de pago.',
  });
  const placeOrder = (key: string) =>
    api('post', '/store/orders', {
      items: [{ variantId: variant.id, quantity: 2 }],
      municipalityCode: '05001',
      customerName: `Cliente Seguimiento ${suffix}`,
      customerPhone: '3001112233',
      addressLine: 'Dirección privada 789',
      paymentMethodId: transfer.id,
      idempotencyKey: `e2e-seguimiento-${key}-${suffix}-${Date.now()}`,
      termsAccepted: true,
      dataProcessingAccepted: true,
    });
  const order = await placeOrder('a');
  const cancelledOrder = await placeOrder('b');
  await logout(page);

  // Recién creado: productos, total sin envío y pasos pendientes. Sin datos de entrega.
  await page.goto(`/seguimiento/${order.publicToken}`);
  await expect(page.getByRole('heading', { name: `Pedido ${order.code}` })).toBeVisible();
  await expect(page.getByText('Sin confirmar').first()).toBeVisible();
  await expect(page.getByText(productName)).toBeVisible();
  await expect(page.getByText('Total sin envío')).toBeVisible();
  await expect(page.getByText('Dirección privada 789')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  // La tienda confirma y despacha con entrega local; el cliente ve el avance.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  await api('patch', `/admin/orders/${order.id}/confirm`, { shippingCost: 7000 });
  await api('patch', `/admin/orders/${order.id}/shipping`, {
    method: 'LOCAL',
    status: 'IN_TRANSIT',
  });
  await api('patch', `/admin/orders/${cancelledOrder.id}/cancel`, {
    reason: 'Cancelación de prueba',
  });
  await logout(page);

  await page.goto(`/seguimiento/${order.publicToken}`);
  await expect(page.getByText('Despachado').first()).toBeVisible();
  await expect(page.getByText('Entrega local de la tienda')).toBeVisible();
  await expect(page.getByText('Listo')).toBeVisible();
  await expect(page.getByText('$ 31.000')).toBeVisible();

  // Pedido cancelado: aviso y sin pasos de avance.
  await page.goto(`/seguimiento/${cancelledOrder.publicToken}`);
  await expect(
    page.getByRole('status').filter({ hasText: 'Este pedido fue cancelado' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Avance del pedido' })).toHaveCount(0);

  // Enlace inválido: no revela nada.
  await page.goto(`/seguimiento/${'f'.repeat(48)}`);
  await expect(
    page.getByRole('heading', { name: 'No pudimos abrir este seguimiento' }),
  ).toBeVisible();
  await expect(page.getByText(order.code)).toHaveCount(0);

  // Rastreador desde el pie de la tienda: código + teléfono, sin enlace.
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Rastrear pedido' }).click();
  await expect(page).toHaveURL(/\/rastrear$/);
  await page.getByLabel('Código del pedido').fill(order.code.toLowerCase());
  await page.getByLabel('Teléfono de la compra').fill('3009999999');
  await page.getByRole('button', { name: 'Ver mi pedido' }).click();
  await expect(
    page.getByText('No encontramos un pedido con esos datos. Revisa el código y el teléfono.'),
  ).toBeVisible();
  await page.getByLabel('Teléfono de la compra').fill('+57 300 111 2233');
  await page.getByRole('button', { name: 'Ver mi pedido' }).click();
  await expect(page).toHaveURL(new RegExp(`/seguimiento/${order.publicToken}$`));
  await expect(page.getByRole('heading', { name: `Pedido ${order.code}` })).toBeVisible();
});
