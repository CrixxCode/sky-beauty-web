import { expect, test, type Page } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout, openNav } from './helpers';

async function openFrom(page: Page, section: 'Pedidos' | 'Pagos', code: string) {
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Panel' })
    .getByRole('link', { name: section })
    .click();
  await expect(page.getByRole('heading', { name: section, level: 1 })).toBeVisible();
  await page.getByRole('textbox', { name: /Buscar pedido/ }).fill(code);
  await page
    .getByRole('row', { name: new RegExp(code) })
    .getByRole('button', { name: 'Ver' })
    .click();
  const dialog = page.getByRole('dialog', { name: `Pedido ${code}` });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeDialog(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('el personal registra el comprobante y la propietaria rechaza, verifica y devuelve el pago', async ({
  page,
}, testInfo) => {
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const staff = {
    name: `Caja ${suffix}`,
    email: `caja.${testInfo.project.name}@ejemplo.test`,
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
  const brand = await api('post', '/admin/brands', { name: `Marca Pago ${suffix}` });
  const category = await api('post', '/admin/categories', { name: `Categoría Pago ${suffix}` });
  const product = await api('post', '/admin/products', {
    name: `Producto Pago ${suffix}`,
    description: 'Producto ficticio para pruebas.',
    brandId: brand.id,
    categoryId: category.id,
    basePrice: 10000,
  });
  const variant = await api('post', `/admin/products/${product.id}/variants`, {
    sku: `E2E-PAGO-${suffix.toUpperCase()}`,
    name: `Tono Pago ${suffix}`,
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
    items: [{ variantId: variant.id, quantity: 2 }],
    municipalityCode: '05001',
    customerName: `Cliente Pago ${suffix}`,
    customerPhone: '3001112233',
    addressLine: 'Dirección ficticia 123',
    paymentMethodId: transfer.id,
    idempotencyKey: `e2e-pago-${suffix}-${Date.now()}`,
    termsAccepted: true,
    dataProcessingAccepted: true,
  });
  await api('patch', `/admin/orders/${order.id}/confirm`, { shippingCost: 5000 });
  await logout(page);

  // El personal registra el comprobante recibido por WhatsApp.
  await login(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin$/);
  let dialog = await openFrom(page, 'Pedidos', order.code);
  await dialog.getByLabel('Referencia del comprobante (opcional)').fill('REF-FICTICIA-001');
  await dialog.getByRole('button', { name: 'Registrar comprobante recibido' }).click();
  await expect(dialog.getByText('Por verificar').first()).toBeVisible();
  // El personal no verifica, y sin el pago verificado no se despacha.
  await expect(dialog.getByRole('button', { name: 'Verificar pago' })).toHaveCount(0);
  await expect(dialog.getByText(/Verifica el pago antes de despachar/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Despachar pedido' })).toBeDisabled();
  await closeDialog(page);
  await logout(page);

  // La propietaria lo encuentra en la bandeja de pagos y lo rechaza.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  dialog = await openFrom(page, 'Pagos', order.code);
  await dialog.getByLabel('Motivo si no hay evidencia del pago').fill('No aparece en la cuenta');
  await dialog.getByRole('button', { name: 'Rechazar pago' }).click();
  await expect(dialog.getByText(/Pago no demostrado\. El cliente tiene hasta/)).toBeVisible();

  // El cliente aclara: nuevo comprobante; la propietaria verifica y luego devuelve.
  await dialog.getByRole('button', { name: 'Registrar comprobante recibido' }).click();
  await dialog.getByLabel('Monto recibido (COP)').fill('24000');
  await expect(dialog.getByText(/Se rechazará como pago incompleto/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Verificar pago' }).click();
  await expect(dialog.getByText(/Pago no demostrado\. El cliente tiene hasta/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Registrar comprobante recibido' }).click();
  await dialog.getByLabel('Monto recibido (COP)').fill('26000');
  await expect(dialog.getByRole('button', { name: 'Verificar pago' })).toBeDisabled();
  await dialog
    .getByLabel('Nota del pago (opcional)')
    .fill('Excedente por devolver por transferencia.');
  await dialog.getByRole('button', { name: 'Verificar pago' }).click();
  await expect(dialog.getByText('Pagado').first()).toBeVisible();
  await expect(dialog.getByText('Preparando').first()).toBeVisible();
  await expect(dialog.getByLabel('Monto a devolver (COP)')).toHaveValue('25000');
  await expect(dialog.getByLabel('Monto a devolver (COP)')).toHaveAttribute('readonly', '');
  await dialog.getByLabel('Costo del envío cotizado (COP)').fill('6000');
  await expect(dialog.getByRole('button', { name: 'Guardar', exact: true })).toBeDisabled();
  await dialog.getByLabel('Motivo o soporte de la devolución').fill('Devolución ficticia');
  await dialog.getByRole('button', { name: 'Registrar devolución' }).click();
  await expect(dialog.getByText('Devuelto').first()).toBeVisible();
  await expect(dialog.getByText('Pago: Devuelto')).toBeVisible();
});
