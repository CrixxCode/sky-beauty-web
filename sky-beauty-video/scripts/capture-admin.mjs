// Recorrido real del panel administrativo (propietaria), en una sola sesión.
//
// Solo modifica el pedido de prueba que creó la grabación de la tienda (lo confirma). Los demás
// registros solo se consultan: los formularios que se abren se cierran sin guardar.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT, adminStorageState } from './lib/env.mjs';
import { launch, newContext, DESKTOP } from './lib/session.mjs';
import { Recorder } from './lib/recorder.mjs';
import { ORDER_FILE } from './capture-store.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Pantalla de inicio de sesión del panel, sin escribir credenciales. */
export async function captureLogin() {
  const browser = await launch(DESKTOP);
  const ctx = await newContext(browser, DESKTOP);
  const rec = new Recorder(ctx, { name: 'login', dir: path.join(ROOT, 'recordings') });
  const page = await rec.open('/admin/login');
  try {
    rec.mark('login');
    await rec.moveTo(980, 520, 1400);
    await rec.wait(900);
    await rec.hover(page.getByRole('button', { name: /Ingresar|Iniciar sesión|Entrar/ }).first(), { ms: 1200 });
    await rec.wait(1500);
    rec.mark('end');
  } finally {
    await rec.close();
    await browser.close();
  }
}

export async function captureAdmin() {
  const { code } = JSON.parse(readFileSync(ORDER_FILE, 'utf8'));
  const browser = await launch(DESKTOP);
  const state = await adminStorageState(browser);
  const ctx = await newContext(browser, DESKTOP, { storageState: state });
  const rec = new Recorder(ctx, { name: 'admin', dir: path.join(ROOT, 'recordings') });
  const page = await rec.open('/admin');
  const nav = (name) => page.getByRole('link', { name, exact: true }).first();
  const dialog = page.getByRole('dialog');
  /** Scroll suave dentro de un diálogo hasta centrar el elemento. */
  const reveal = async (locator) => {
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await sleep(900);
  };

  try {
    // ── Resumen ──────────────────────────────────────────────────────────
    rec.mark('dashboard');
    await rec.moveTo(760, 330, 1100);
    await rec.wait(1600);
    await rec.hover(page.getByText('Ventas de los últimos 30 días').first(), { ms: 900 });
    await rec.moveTo(820, 640, 900);
    await rec.wait(2200);

    // ── Pedidos: el pedido que acaba de crear la clienta ─────────────────
    await rec.click(nav('Pedidos'));
    await page.waitForURL(/\/admin\/pedidos/);
    await rec.settle();
    rec.mark('orders');
    await rec.moveTo(600, 500, 800);
    await rec.wait(1700);
    const row = page.getByRole('row', { name: new RegExp(code) });
    await rec.click(row.getByRole('link', { name: 'Ver', exact: true }).or(row.getByRole('button', { name: 'Ver', exact: true })).first());
    await dialog.waitFor();
    await rec.wait(600);
    rec.mark('order-detail');
    await rec.moveTo(820, 380, 900);
    await rec.wait(1800);
    const confirm = dialog.getByRole('button', { name: /Confirmar pedido/ });
    if (await confirm.count()) {
      await reveal(confirm);
      rec.mark('order-actions');
      await rec.wait(700);
      await rec.click(confirm);
      rec.mark('order-confirmed');
    } else {
      // El pedido ya estaba confirmado (grabación repetida sin volver a grabar la tienda).
      console.warn('  ⚠ El pedido de prueba ya estaba confirmado: graba antes la tienda (store).');
      await reveal(dialog.getByText('Acciones').first());
      rec.mark('order-actions');
      rec.mark('order-confirmed');
    }
    await rec.wait(2400);
    await rec.click(dialog.getByRole('button', { name: /Cerrar/ }).last());
    await rec.wait(900);

    // ── Productos: gestión de variantes, fotos y precios ─────────────────
    await rec.click(nav('Productos'));
    await page.waitForURL(/\/admin\/productos/);
    await rec.settle();
    rec.mark('products');
    await rec.wait(900);
    await rec.type(page.getByPlaceholder('Buscar por nombre...'), 'Labial', 110);
    await rec.wait(1100);
    rec.mark('products-search');
    const product = page.getByRole('row', { name: /Labial mate Demo/ });
    await rec.click(product.getByRole('button', { name: /Gestionar/ }).or(product.getByRole('link', { name: /Gestionar/ })).first());
    await dialog.waitFor();
    rec.mark('product-manage');
    await rec.moveTo(760, 560, 900);
    await rec.wait(2000);
    await rec.click(dialog.getByRole('tab', { name: /Fotos/ }).or(dialog.getByRole('button', { name: /Fotos/ })).first());
    rec.mark('product-photos');
    await rec.wait(2000);
    await rec.click(dialog.getByRole('tab', { name: /Información y precios/ }).or(dialog.getByRole('button', { name: /Información y precios/ })).first());
    rec.mark('product-info');
    await rec.wait(1900);
    await page.keyboard.press('Escape');
    await rec.wait(800);

    // ── Inventario ───────────────────────────────────────────────────────
    await rec.click(nav('Inventario'));
    await page.waitForURL(/\/admin\/inventario/);
    await rec.settle();
    rec.mark('inventory');
    await rec.wait(1500);
    await rec.click(page.getByRole('button', { name: /Stock bajo/ }).first());
    rec.mark('inventory-low');
    await rec.wait(2200);

    // ── Promociones ──────────────────────────────────────────────────────
    await rec.click(nav('Promociones'));
    await page.waitForURL(/\/admin\/promociones/);
    await rec.settle();
    rec.mark('promotions');
    await rec.wait(1500);
    const promo = page.getByRole('row', { name: /Demo 20 % labial mate/ });
    await rec.click(promo.getByRole('button', { name: /Editar/ }).first());
    await dialog.waitFor();
    rec.mark('promotion-edit');
    await rec.moveTo(760, 480, 900);
    await rec.wait(2400);
    await page.keyboard.press('Escape');
    await rec.wait(700);

    // ── Reportes ─────────────────────────────────────────────────────────
    await rec.click(nav('Reportes'));
    await page.waitForURL(/\/admin\/reportes/);
    await rec.settle();
    rec.mark('reports');
    await rec.wait(1800);
    await rec.click(page.getByRole('tab', { name: 'Más vendidos' }));
    rec.mark('reports-top');
    await rec.wait(1600);
    await rec.scrollTo(380, 1400);
    await rec.wait(1800);
    rec.mark('end');
  } finally {
    await rec.close();
    await browser.close();
  }
}
