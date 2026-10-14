import { expect, test } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, openNav, pick } from './helpers';

test('la propietaria publica un testimonio; la tienda muestra ofertas, favoritos y agregar desde la tarjeta', async ({
  page,
}, testInfo) => {
  // Recorre el panel y varias páginas de la tienda.
  test.setTimeout(90_000);
  // Cada proyecto (celular, escritorio) usa sus propios datos: comparten la base de pruebas.
  // Los nombres no deben contener palabras de etiquetas de otros formularios (p. ej. "Inicio").
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const product = `Producto Vitrina ${suffix}`;
  const author = `Clienta Ficticia ${suffix}`;

  // La propietaria prepara un producto de una sola variante, con existencias y en promoción.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  const api = async (method: 'post' | 'patch', url: string, data: object) => {
    const res = await page.request[method](`/api/v1${url}`, { data });
    expect(res.ok(), `${method} ${url}`).toBe(true);
    return (await res.json()) as { id: string };
  };
  const brand = await api('post', '/admin/brands', { name: `Marca Vitrina ${suffix}` });
  const category = await api('post', '/admin/categories', { name: `Categoría Vitrina ${suffix}` });
  const created = await api('post', '/admin/products', {
    name: product,
    description: 'Producto ficticio para pruebas.',
    brandId: brand.id,
    categoryId: category.id,
    basePrice: 20000,
  });
  const variant = await api('post', `/admin/products/${created.id}/variants`, {
    sku: `E2E-VITRINA-${suffix.toUpperCase()}`,
    name: `Tono Vitrina ${suffix}`,
  });
  await api('post', '/admin/inventory/movements', {
    variantId: variant.id,
    type: 'INITIAL',
    quantity: 5,
  });
  await api('patch', `/admin/products/${created.id}/status`, { status: 'ACTIVE' });
  await api('post', '/admin/promotions', {
    name: `Promo Vitrina ${suffix}`,
    discountType: 'PERCENTAGE',
    discountValue: 20,
    scope: 'PRODUCT',
    productIds: [created.id],
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 86_400_000).toISOString(),
  });

  // Registra y publica un testimonio desde el panel.
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Panel' })
    .getByRole('link', { name: 'Testimonios' })
    .click();
  await expect(page.getByRole('heading', { name: 'Testimonios', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Agregar testimonio' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo testimonio' });
  await dialog.getByLabel('Nombre *').fill(author);
  await dialog.getByLabel('Inicial del apellido *').fill('g.');
  await pick(page, 'Valoración *', '5 estrellas', dialog);
  await dialog.getByLabel('Comentario *').fill(`Comentario ficticio ${suffix}.`);
  await pick(page, 'Producto que compró (opcional)', product, dialog);
  await dialog.getByRole('switch').click();
  await dialog.getByRole('button', { name: 'Agregar testimonio' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`${author} G.`)).toBeVisible();
  // Sale del panel sin pasar por el menú lateral (en celular puede seguir abierto tras navegar).
  await page.context().clearCookies();

  // El inicio muestra el testimonio con el producto comprado y la franja de ofertas.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lo que dicen nuestras clientas' })).toBeVisible();
  const testimonial = page.getByRole('figure').filter({ hasText: `${author} G.` });
  await expect(testimonial).toContainText(`Comentario ficticio ${suffix}.`);
  await expect(testimonial.getByRole('link', { name: product })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Precios especiales' })).toBeVisible();

  // Ofertas en el catálogo, ordenadas por descuento y con el filtro visible.
  await page.goto(`/productos?ofertas=1&q=${encodeURIComponent(product)}`);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Resultados');
  await expect(page.getByRole('link', { name: 'Quitar el filtro de ofertas' })).toBeVisible();
  const card = page.getByRole('article').filter({ hasText: product });
  await expect(card).toContainText('−20%');

  // Favoritos sin cuenta: se guardan en el navegador y se ven en /favoritos.
  await card.getByRole('button', { name: `Guardar ${product} en favoritos` }).click();
  await expect(page.getByRole('link', { name: 'Favoritos, 1 producto' })).toBeVisible();
  await page.goto('/favoritos');
  await expect(page.getByRole('heading', { name: product })).toBeVisible();

  // Agregar a la bolsa desde la tarjeta (producto de una sola variante).
  await page.getByRole('button', { name: `Agregar ${product} a la bolsa` }).click();
  await expect(page.getByRole('link', { name: 'Bolsa de compra, 1 producto' })).toBeVisible();

  // Quitar de favoritos deja la página vacía (persistido tras recargar).
  await page.getByRole('button', { name: `Guardar ${product} en favoritos` }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Aún no tienes favoritos' })).toBeVisible();
});
