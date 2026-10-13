import { expect, test } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout, pick } from './helpers';

test('un cliente compra sin cuenta, las existencias quedan reservadas y WhatsApp lleva el pedido', async ({
  page,
}, testInfo) => {
  // Cada proyecto (celular, escritorio) usa sus propios datos: comparten la base de pruebas.
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const product = `Producto Compra ${suffix}`;
  const variantName = `Tono Compra ${suffix}`;

  // La propietaria prepara producto con existencias, método de pago, tarifa y WhatsApp.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const api = async (method: 'post' | 'patch', url: string, data: object) => {
    const res = await page.request[method](`/api/v1${url}`, { data });
    expect(res.ok(), `${method} ${url}`).toBe(true);
    return (await res.json()) as { id: string };
  };
  const brand = await api('post', '/admin/brands', { name: `Marca Compra ${suffix}` });
  const category = await api('post', '/admin/categories', { name: `Categoría Compra ${suffix}` });
  const created = await api('post', '/admin/products', {
    name: product,
    description: 'Producto ficticio para pruebas.',
    brandId: brand.id,
    categoryId: category.id,
    basePrice: 15000,
  });
  const variant = await api('post', `/admin/products/${created.id}/variants`, {
    sku: `E2E-COMPRA-${suffix.toUpperCase()}`,
    name: variantName,
  });
  await api('post', '/admin/inventory/movements', {
    variantId: variant.id,
    type: 'INITIAL',
    quantity: 10,
  });
  await api('patch', `/admin/products/${created.id}/status`, { status: 'ACTIVE' });
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
  await api('patch', '/admin/settings', { whatsappNumber: '3009998877' });
  await api('post', '/admin/settings/shipping-rates', { municipalityCode: '44001', amount: 5000 });
  await logout(page);

  // El cliente agrega 2 unidades desde el detalle.
  const slug = product.toLowerCase().replace(/\s+/g, '-');
  await page.goto(`/producto/${slug}`);
  await page.getByRole('button', { name: 'Aumentar cantidad' }).click();
  await page.getByRole('button', { name: 'Agregar a la bolsa' }).click();
  await expect(page.getByRole('link', { name: 'Bolsa de compra, 2 productos' })).toBeVisible();

  // El carrito se conserva al recargar.
  await page.goto('/carrito');
  await page.reload();
  const line = page.getByRole('article').filter({ hasText: product });
  await expect(line).toBeVisible();
  await expect(line.getByText('$ 15.000')).toBeVisible();
  await page.getByRole('link', { name: 'Continuar al checkout' }).click();

  // Checkout.
  await expect(page).toHaveURL(/\/checkout$/);
  await page.getByLabel('Nombre completo').fill('Cliente Ficticio');
  await page.getByLabel('Teléfono / WhatsApp').fill('3001112233');
  await pick(page, 'Departamento', 'La Guajira');
  await pick(page, 'Municipio', 'Riohacha');
  await page.getByLabel('Dirección').fill('Dirección ficticia 123');
  await expect(page.getByText('$ 5.000')).toBeVisible();
  await page.getByRole('radio', { name: /Transferencia bancaria/ }).click();
  await expect(page.getByText('Instrucciones ficticias de pago.')).toBeVisible();

  const submit = page.getByRole('button', { name: 'Crear pedido' });
  await page.getByRole('checkbox', { name: 'Acepto los términos y condiciones.' }).click();
  await submit.click();
  await expect(page.getByText('Debes marcar las dos casillas obligatorias.')).toBeVisible();
  await page
    .getByRole('checkbox', { name: /Autorizo el tratamiento de mis datos personales/ })
    .click();
  await submit.click();

  // Pedido creado: WhatsApp con el pedido y enlace privado.
  await expect(page).toHaveURL(/\/pedido\/SB-/);
  const code = page.url().split('/pedido/')[1];
  await expect(page.getByText(code)).toBeVisible();
  const whatsapp = page.getByRole('link', { name: 'Abrir WhatsApp' });
  const href = (await whatsapp.getAttribute('href')) ?? '';
  expect(href.startsWith('https://wa.me/573009998877?text=')).toBe(true);
  const message = decodeURIComponent(href.split('?text=')[1]);
  expect(message).toContain(`pedido ${code}`);
  expect(message).toContain(`${product} (${variantName}) x2`);
  expect(message).toContain('Municipio: Riohacha, La Guajira');
  expect(message).toContain('Dirección: Dirección ficticia 123');
  expect(message).toMatch(/Seguimiento del pedido: http:\/\/localhost:3100\/seguimiento\/[a-f0-9]{48}/);

  // El carrito quedó vacío.
  await expect(page.getByRole('link', { name: 'Bolsa de compra, 0 productos' })).toBeVisible();

  await page.getByRole('link', { name: 'Ver el estado de mi pedido' }).click();
  await expect(page).toHaveURL(/\/seguimiento\//);
  await expect(page.getByText(code)).toBeVisible();

  // Las existencias quedaron reservadas: 10 - 2 = 8.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const stock = (await (
    await page.request.get(`/api/v1/admin/inventory/variants?q=${encodeURIComponent(variantName)}`)
  ).json()) as Array<{ stock: number }>;
  expect(stock[0].stock).toBe(8);
});
