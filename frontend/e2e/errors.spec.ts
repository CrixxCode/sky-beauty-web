import { expect, test } from '@playwright/test';

test('las direcciones y productos que no existen muestran la página de la tienda', async ({
  page,
}) => {
  for (const path of ['/esta-pagina-no-existe', '/producto/producto-que-no-existe']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
    // Con el encabezado y el pie de la tienda.
    await expect(page.getByRole('navigation', { name: 'Información legal' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver productos' })).toBeVisible();
  }
});

test('las páginas envían los encabezados de seguridad', async ({ page }) => {
  const response = await page.goto('/admin/login');
  const headers = response?.headers() ?? {};
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
});
