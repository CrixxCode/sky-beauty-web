import { expect, test } from '@playwright/test';
import { E2E_OWNER } from './env';
import { login, logout, openNav } from './helpers';

const EMPTY_CONTENT = {
  heroTitle: null,
  heroSubtitle: null,
  announcementText: null,
  tagline: null,
  termsText: null,
  privacyText: null,
  returnsPolicyText: null,
  shippingPolicyText: null,
};

test('la propietaria publica el contenido y la tienda lo muestra; sin texto, aviso de disponible pronto', async ({
  page,
}, testInfo) => {
  const suffix = testInfo.project.name === 'movil' ? 'Movil' : 'Escritorio';
  const staff = {
    name: `Contenido ${suffix}`,
    email: `contenido.${testInfo.project.name}@ejemplo.test`,
    password: 'clave-personal-123',
  };

  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.request.patch('/api/v1/admin/content', { data: EMPTY_CONTENT });
  expect((await page.request.post('/api/v1/admin/users', { data: staff })).ok()).toBe(true);

  // La propietaria edita el inicio y una página legal.
  await openNav(page);
  await page
    .getByRole('navigation', { name: 'Panel' })
    .getByRole('link', { name: 'Contenido' })
    .click();
  await expect(page.getByRole('heading', { name: 'Contenido', level: 1 })).toBeVisible();
  await page.getByLabel('Título principal').fill(`Título ficticio ${suffix}`);
  await page.getByLabel('Barra de anuncio (opcional)').fill(`Anuncio ficticio ${suffix}`);
  await page
    .getByLabel('Descripción de la tienda (opcional)')
    .fill(`Descripción ficticia ${suffix}`);
  await page.getByRole('button', { name: 'Guardar inicio' }).click();
  await expect(page.getByText('Contenido guardado.')).toBeVisible();
  await page
    .getByLabel('Términos y condiciones')
    .fill('# Texto ficticio de prueba\n\nPárrafo con **negrita**.\n\n- Punto uno\n- Punto dos');
  await page.getByRole('button', { name: 'Guardar páginas legales' }).click();
  await expect(page.getByText('Contenido guardado.').last()).toBeVisible();
  await logout(page);

  // El personal lo ve sin poder editar.
  await login(page, staff.email, staff.password);
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/contenido');
  await expect(page.getByLabel('Título principal')).toHaveValue(`Título ficticio ${suffix}`);
  await expect(page.getByLabel('Título principal')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Guardar inicio' })).toHaveCount(0);
  await logout(page);

  // La tienda: anuncio, título del inicio y descripción para buscadores y redes.
  await page.goto('/');
  await expect(page.getByText(`Anuncio ficticio ${suffix}`)).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: `Título ficticio ${suffix}` }),
  ).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    `Descripción ficticia ${suffix}`,
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    'content',
    `Descripción ficticia ${suffix}`,
  );

  // El pie enlaza las cuatro páginas; la publicada muestra su texto.
  const footer = page.getByRole('contentinfo');
  await expect(footer.getByRole('link', { name: 'Datos personales' })).toBeVisible();
  await footer.getByRole('link', { name: 'Términos y condiciones' }).click();
  await expect(page).toHaveURL(/\/terminos$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Términos y condiciones' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Texto ficticio de prueba' })).toBeVisible();
  await expect(page.getByText('negrita')).toHaveJSProperty('tagName', 'STRONG');
  // Solo las del texto: el menú de categorías del encabezado también es una lista.
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(2);

  // Sin texto: aviso de que estará disponible pronto, y no se indexa.
  const missing = await page.goto('/datos-personales');
  expect(missing?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Tratamiento de datos personales' }),
  ).toBeVisible();
  await expect(page.getByText('Esta información estará disponible pronto.')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  // Contacto, robots y mapa del sitio.
  await page.goto('/contacto');
  await expect(page.getByRole('heading', { level: 1, name: 'Contacto' })).toBeVisible();
  const robots = await page.request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /admin');
  const sitemap = await (await page.request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/terminos');
  expect(sitemap).not.toContain('/datos-personales');

  // Deja el contenido como estaba para las demás pruebas.
  await login(page, E2E_OWNER.email, E2E_OWNER.password);
  await expect(page).toHaveURL(/\/admin$/);
  expect((await page.request.patch('/api/v1/admin/content', { data: EMPTY_CONTENT })).ok()).toBe(
    true,
  );
});
