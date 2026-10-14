// Reconocimiento: capturas de página completa de todas las vistas, en escritorio y celular.
// Sirve para escribir el storyboard sobre las pantallas reales.
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { ROOT, SITE, adminStorageState } from './lib/env.mjs';

const OUT = path.join(ROOT, 'screenshots', 'recon');
mkdirSync(OUT, { recursive: true });

const STORE = [
  ['home', '/'],
  ['catalogo', '/productos'],
  ['ofertas', '/productos?ofertas=1'],
  ['detalle', '/producto/labial-mate-demo'],
  ['favoritos', '/favoritos'],
  ['carrito', '/carrito'],
  ['checkout', '/checkout'],
  ['rastrear', '/rastrear'],
  ['contacto', '/contacto'],
];
const ADMIN = [
  'login', '', 'pedidos', 'pagos', 'avisos', 'productos', 'categorias', 'marcas', 'inventario',
  'promociones', 'envios', 'reportes', 'testimonios', 'contenido', 'configuracion', 'cuentas',
];

const browser = await chromium.launch();
const errors = [];
async function shoot(ctx, name, url, full = true) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name} console: ${m.text()}`));
  await page.goto(SITE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  await page.close();
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
for (const [n, u] of STORE) {
  await shoot(desktop, `d-${n}`, u);
  await shoot(mobile, `m-${n}`, u);
}
const state = await adminStorageState(browser);
const admin = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: state });
const anon = await browser.newContext({ viewport: { width: 1440, height: 900 } });
for (const a of ADMIN) {
  await shoot(a === 'login' ? anon : admin, `a-${a || 'resumen'}`, `/admin/${a}`, false);
}
console.log(errors.length ? errors.join('\n') : 'Sin errores de consola');
await browser.close();
