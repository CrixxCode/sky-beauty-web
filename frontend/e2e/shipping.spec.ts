import { expect, test } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout, openNav, pick } from './helpers';

test('el personal crea una transportadora, despacha con guía y entrega; el cliente ve el rastreo', async ({
  page,
}, testInfo) => {
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const carrier = `Transportadora Ficticia ${suffix}`;
  const guide = `GUIA-${suffix.toUpperCase()}-001`;
  const staff = {
    name: `Bodega Envíos ${suffix}`,
    email: `envios.${testInfo.project.name}@ejemplo.test`,
    password: 'clave-personal-123',
  };

  // Datos: producto con existencias, transferencia activa, personal y un pedido confirmado.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const api = async (method: 'post' | 'patch', url: string, data: object) => {
    const res = await page.request[method](`/api/v1${url}`, { data });
    expect(res.ok(), `${method} ${url}`).toBe(true);
    return (await res.json()) as Record<string, string>;
  };
  const brand = await api('post', '/admin/brands', { name: `Marca Envío ${suffix}` });
  const category = await api('post', '/admin/categories', { name: `Categoría Envío ${suffix}` });
  const product = await api('post', '/admin/products', {
    name: `Producto Envío ${suffix}`,
    description: 'Producto ficticio para pruebas.',
    brandId: brand.id,
    categoryId: category.id,
    basePrice: 10000,
  });
  const variant = await api('post', `/admin/products/${product.id}/variants`, {
    sku: `E2E-ENVIO-${suffix.toUpperCase()}`,
    name: `Tono Envío ${suffix}`,
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
    customerName: `Cliente Envío ${suffix}`,
    customerPhone: '3001112233',
    addressLine: 'Dirección ficticia 123',
    paymentMethodId: transfer.id,
    idempotencyKey: `e2e-envio-${suffix}-${Date.now()}`,
    termsAccepted: true,
    dataProcessingAccepted: true,
  });
  await api('patch', `/admin/orders/${order.id}/confirm`, { shippingCost: 8000 });
  const localOrder = await api('post', '/store/orders', {
    items: [{ variantId: variant.id, quantity: 1 }],
    municipalityCode: '44001',
    customerName: `Cliente Local ${suffix}`,
    customerPhone: '3001112233',
    addressLine: 'Dirección ficticia 456',
    paymentMethodId: transfer.id,
    idempotencyKey: `e2e-envio-local-${suffix}-${Date.now()}`,
    termsAccepted: true,
    dataProcessingAccepted: true,
  });
  await api('patch', `/admin/orders/${localOrder.id}/confirm`, { shippingCost: 5000 });
  await logout(page);

  // El personal crea la transportadora.
  await login(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin$/);
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Panel' })
    .getByRole('link', { name: 'Envíos' })
    .click();
  await expect(page.getByRole('heading', { name: 'Envíos', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Crear transportadora' }).click();
  const form = page.getByRole('dialog', { name: 'Crear transportadora' });
  await form.getByLabel('Nombre').fill(carrier);
  await form
    .getByLabel('Enlace de rastreo (opcional)')
    .fill('https://rastreo.ejemplo.test/{tracking}');
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Transportadora creada.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Despacha el pedido con transportadora y guía.
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Panel' })
    .getByRole('link', { name: 'Pedidos' })
    .click();
  await page.getByRole('textbox', { name: /Buscar pedido/ }).fill(order.code);
  await page
    .getByRole('row', { name: new RegExp(order.code) })
    .getByRole('button', { name: 'Ver' })
    .click();
  const dialog = page.getByRole('dialog', { name: `Pedido ${order.code}` });
  await pick(page, 'Transportadora', carrier, dialog);
  await dialog.getByLabel('Número de guía').fill(guide);
  await pick(page, 'Estado del envío', 'En tránsito', dialog);
  await dialog.getByRole('button', { name: 'Guardar envío' }).click();
  await expect(dialog.getByText('Despachado').first()).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'Abrir el rastreo de la transportadora' }),
  ).toHaveAttribute('href', `https://rastreo.ejemplo.test/${guide}`);

  // Lo marca entregado.
  await pick(page, 'Estado del envío', 'Entregado', dialog);
  await dialog.getByRole('button', { name: 'Guardar envío' }).click();
  await expect(dialog.getByText('El pedido fue entregado.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Entrega local: sin transportadora ni guía.
  await page.getByRole('textbox', { name: /Buscar pedido/ }).fill(localOrder.code);
  await page
    .getByRole('row', { name: new RegExp(localOrder.code) })
    .getByRole('button', { name: 'Ver' })
    .click();
  const local = page.getByRole('dialog', { name: `Pedido ${localOrder.code}` });
  await local.getByRole('radio', { name: 'Entrega local' }).click();
  await expect(local.getByLabel('Número de guía')).toHaveCount(0);
  await pick(page, 'Estado del envío', 'En tránsito', local);
  await local.getByRole('button', { name: 'Guardar envío' }).click();
  await expect(local.getByText('Despachado').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await logout(page);

  await page.goto(`/seguimiento/${localOrder.publicToken}`);
  await expect(page.getByText('Entrega local de la tienda')).toBeVisible();

  // El cliente ve la guía y el rastreo en su enlace privado.
  await page.goto(`/seguimiento/${order.publicToken}`);
  await expect(page.getByText(guide)).toBeVisible();
  await expect(page.getByText(carrier)).toBeVisible();
  await expect(page.getByRole('link', { name: /Rastrear en la transportadora/ })).toHaveAttribute(
    'href',
    `https://rastreo.ejemplo.test/${guide}`,
  );
});
