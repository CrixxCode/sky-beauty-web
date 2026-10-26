import { expect, test, type Page } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout, openNav } from './helpers';

async function openOrder(page: Page, code: string) {
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Panel' })
    .getByRole('link', { name: 'Pedidos' })
    .click();
  await expect(page.getByRole('heading', { name: 'Pedidos', level: 1 })).toBeVisible();
  await page.getByRole('textbox', { name: /Buscar pedido/ }).fill(code);
  await page
    .getByRole('row', { name: new RegExp(code) })
    .getByRole('button', { name: 'Ver' })
    .click();
  const dialog = page.getByRole('dialog', { name: `Pedido ${code}` });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('el personal edita un pedido sin confirmar, lo confirma y avanza su estado; la propietaria cancela otro', async ({
  page,
}, testInfo) => {
  // Cada proyecto (celular, escritorio) usa sus propios datos: comparten la base de pruebas.
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const product = `Producto Pedido ${suffix}`;
  const staff = {
    name: `Despachos ${suffix}`,
    email: `despachos.${testInfo.project.name}@ejemplo.test`,
    password: 'clave-personal-123',
  };

  // Datos: producto con existencias, transferencia activa y cuenta del personal.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const api = async (method: 'post' | 'patch' | 'get', url: string, data?: object) => {
    const res = await page.request[method](`/api/v1${url}`, data ? { data } : undefined);
    expect(res.ok(), `${method} ${url}`).toBe(true);
    return (await res.json()) as Record<string, unknown>;
  };
  const brand = await api('post', '/admin/brands', { name: `Marca Pedido ${suffix}` });
  const category = await api('post', '/admin/categories', { name: `Categoría Pedido ${suffix}` });
  const created = await api('post', '/admin/products', {
    name: product,
    description: 'Producto ficticio para pruebas.',
    brandId: brand.id,
    categoryId: category.id,
    basePrice: 10000,
  });
  const variant = await api('post', `/admin/products/${created.id as string}/variants`, {
    sku: `E2E-PEDIDO-${suffix.toUpperCase()}`,
    name: `Tono Pedido ${suffix}`,
  });
  await api('post', '/admin/inventory/movements', {
    variantId: variant.id,
    type: 'INITIAL',
    quantity: 10,
  });
  await api('patch', `/admin/products/${created.id as string}/status`, { status: 'ACTIVE' });
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

  // Dos pedidos de clientes desde la tienda (sin envío calculado: Medellín no tiene tarifa).
  const placeOrder = async () =>
    (await api('post', '/store/orders', {
      items: [{ variantId: variant.id, quantity: 2 }],
      municipalityCode: '05001',
      customerName: `Cliente ${suffix}`,
      customerPhone: '3001112233',
      addressLine: 'Dirección ficticia 123',
      paymentMethodId: transfer.id,
      idempotencyKey: `e2e-pedido-${suffix}-${Date.now()}-${Math.random()}`,
      termsAccepted: true,
      dataProcessingAccepted: true,
    })) as { code: string };
  const first = await placeOrder();
  const second = await placeOrder();
  await logout(page);

  // El personal edita, cotiza el envío, confirma y avanza el estado.
  await login(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin$/);
  let dialog = await openOrder(page, first.code);
  await expect(dialog.getByLabel('Enlace de seguimiento del cliente')).toHaveValue(
    /^http:\/\/localhost:3100\/seguimiento\/[a-f0-9]{48}$/,
  );
  await dialog.getByRole('button', { name: 'Editar productos' }).click();
  const edit = page.getByRole('dialog', { name: 'Editar productos' });
  await edit.getByRole('button', { name: /Aumentar cantidad/ }).click();
  await edit.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Productos actualizados.')).toBeVisible();
  dialog = page.getByRole('dialog', { name: `Pedido ${first.code}` });
  await expect(dialog.getByText('$ 30.000').first()).toBeVisible();

  // El costo del envío se escribe junto al botón de confirmar.
  await expect(dialog.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled();
  await expect(
    dialog.getByText('Cotiza el envío con el cliente y escríbelo aquí para confirmar.'),
  ).toBeVisible();
  await dialog.getByLabel('Costo del envío (COP)', { exact: true }).fill('6000');
  await dialog.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(dialog.getByText('Confirmado').first()).toBeVisible();
  await expect(dialog.getByText('$ 36.000')).toBeVisible();

  // El mensaje de confirmación para el cliente queda en el mismo pedido.
  const messages = dialog.getByRole('region', { name: 'Mensajes por enviar al cliente' });
  await expect(messages.getByText('Pedido confirmado').first()).toBeVisible();
  await expect(messages.getByRole('link', { name: 'Abrir en WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/573001112233\?text=/,
  );
  await messages.getByRole('button', { name: 'Marcar como enviado' }).click();
  await expect(page.getByText('Mensaje marcado como enviado.')).toBeVisible();
  await expect(messages).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Marcar en preparación' }).click();
  await expect(dialog.getByText('Preparando').first()).toBeVisible();
  // El personal no ve la cancelación (el pago no está rechazado).
  await expect(dialog.getByLabel('Motivo de la cancelación')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await logout(page);

  // La propietaria cancela el segundo pedido y se liberan sus existencias.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  dialog = await openOrder(page, second.code);
  const cancel = dialog.getByRole('button', { name: 'Cancelar pedido y liberar existencias' });
  await expect(cancel).toBeDisabled();
  await dialog.getByLabel('Motivo de la cancelación').fill('El cliente desistió (prueba)');
  await cancel.click();
  await expect(dialog.getByText('Pedido cancelado: El cliente desistió (prueba)')).toBeVisible();

  // Existencias: 10 - 3 (primer pedido editado) - 2 (segundo) + 2 (cancelado) = 7.
  const stock = (await (
    await page.request.get(
      `/api/v1/admin/inventory/variants?q=${encodeURIComponent(`E2E-PEDIDO-${suffix.toUpperCase()}`)}`,
    )
  ).json()) as Array<{ stock: number }>;
  expect(stock[0].stock).toBe(7);
});
