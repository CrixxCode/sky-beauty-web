import { expect, test } from '@playwright/test';
import { E2E_OWNER } from './env';
import { advanceOrder, login, logout } from './helpers';

test('aviso antes de cancelar, cancelación automática, bandeja de avisos y notificaciones', async ({
  page,
}, testInfo) => {
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const staff = {
    name: `Avisos ${suffix}`,
    email: `avisos.${testInfo.project.name}@ejemplo.test`,
    password: 'clave-personal-123',
  };

  // Datos: producto con existencias, transferencia activa, personal y un pedido sin confirmar.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const api = async (method: 'post' | 'patch', url: string, data: object) => {
    const res = await page.request[method](`/api/v1${url}`, { data });
    expect(res.ok(), `${method} ${url}`).toBe(true);
    return (await res.json()) as Record<string, string>;
  };
  const brand = await api('post', '/admin/brands', { name: `Marca Avisos ${suffix}` });
  const category = await api('post', '/admin/categories', { name: `Categoría Avisos ${suffix}` });
  const product = await api('post', '/admin/products', {
    name: `Producto Avisos ${suffix}`,
    description: 'Producto ficticio para pruebas.',
    brandId: brand.id,
    categoryId: category.id,
    basePrice: 10000,
  });
  const variant = await api('post', `/admin/products/${product.id}/variants`, {
    sku: `E2E-AVISO-${suffix.toUpperCase()}`,
    name: `Tono Avisos ${suffix}`,
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
  await api('post', '/admin/users', staff);
  const order = await api('post', '/store/orders', {
    items: [{ variantId: variant.id, quantity: 1 }],
    municipalityCode: '05001',
    customerName: `Cliente Avisos ${suffix}`,
    customerPhone: '3001112233',
    addressLine: 'Dirección ficticia 123',
    paymentMethodId: transfer.id,
    idempotencyKey: `e2e-avisos-${suffix}-${Date.now()}`,
    termsAccepted: true,
    dataProcessingAccepted: true,
  });
  await logout(page);

  // Faltan 30 minutos para las 48 horas: aviso "se cancelará en 1 hora".
  advanceOrder(order.code, 47.5);

  await page.goto(`/seguimiento/${order.publicToken}`);
  await expect(page.getByRole('status').filter({ hasText: 'se cancelará el' })).toBeVisible();

  // El personal recibe la notificación y envía el aviso desde la bandeja.
  await login(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: /^Notificaciones, \d+ sin leer$/ }).click();
  await page
    .getByRole('button', { name: new RegExp(`Aviso por enviar: pedido ${order.code}`) })
    .click();
  await expect(page).toHaveURL(/\/admin\/avisos$/);

  const notice = page.getByRole('article', { name: `Aviso del pedido ${order.code}` });
  await expect(notice.getByText('Se cancelará en 1 hora', { exact: true })).toBeVisible();
  const whatsapp = notice.getByRole('link', { name: 'Abrir en WhatsApp' });
  const href = (await whatsapp.getAttribute('href')) ?? '';
  expect(href.startsWith('https://wa.me/573001112233?text=')).toBe(true);
  expect(decodeURIComponent(href)).toContain(`Tu pedido ${order.code} se cancelará en 1 hora`);
  await notice.getByRole('button', { name: 'Marcar como enviado' }).click();
  await expect(page.getByText('Aviso marcado como enviado.')).toBeVisible();
  await page.getByRole('tab', { name: 'Enviados' }).click();
  await expect(
    page
      .getByRole('article', { name: `Aviso del pedido ${order.code}` })
      .getByText(`por ${staff.name}`),
  ).toBeVisible();
  await logout(page);

  // Vence el plazo: el pedido se cancela solo y se crea el aviso de cancelación.
  advanceOrder(order.code, 48.2);

  await page.goto(`/seguimiento/${order.publicToken}`);
  await expect(
    page.getByRole('status').filter({ hasText: `Tu pedido ${order.code} fue cancelado.` }),
  ).toBeVisible();
  await expect(page.getByText(`Cliente Avisos ${suffix}`)).toHaveCount(0);

  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: /^Notificaciones/ }).click();
  await expect(
    page.getByRole('button', {
      name: new RegExp(`Pedido ${order.code} cancelado automáticamente`),
    }),
  ).toBeVisible();
});
