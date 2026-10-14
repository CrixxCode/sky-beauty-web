// Recorrido real de la tienda, grabado de corrido en una sola sesión del navegador:
// inicio → búsqueda y filtros → detalle → favoritos → bolsa → checkout → pedido creado → seguimiento.
//
// El checkout crea un pedido de prueba en la base de DESARROLLO con datos evidentemente ficticios
// (teléfono 3000000099, del rango de clientes de demostración). `npm run db:demo:clean` lo borra
// junto con el resto de los datos de demostración. Nunca se ejecuta contra producción.
import path from 'node:path';
import { ROOT } from './lib/env.mjs';
import { launch, newContext, DESKTOP } from './lib/session.mjs';
import { Recorder } from './lib/recorder.mjs';

export const ORDER_FILE = path.join(ROOT, 'recordings', 'video-order.json');

export async function captureStore() {
  const browser = await launch(DESKTOP);
  const ctx = await newContext(browser, DESKTOP);
  const rec = new Recorder(ctx, { name: 'store', dir: path.join(ROOT, 'recordings') });
  const page = await rec.open('/');
  const heading = (name) => page.getByRole('heading', { name, exact: true }).first();

  try {
    // ── Escena 2 · Inicio ────────────────────────────────────────────────
    rec.mark('home');
    await rec.moveTo(520, 520, 900);
    await rec.wait(2600);
    await rec.hover(page.getByRole('link', { name: /Explorar productos/ }).first());
    await rec.wait(1200);
    await rec.moveTo(1180, 640, 900);
    rec.mark('home-scroll');
    await rec.scrollToElement(heading('Explora por tipo de producto'), 60, 1500);
    rec.mark('home-categorias');
    const categories = heading('Explora por tipo de producto').locator('xpath=ancestor::section[1]');
    await rec.hover(categories.getByRole('link', { name: /Demo Labios/ }).first(), { dy: 0.35 });
    await rec.wait(1500);
    await rec.scrollToElement(heading('Recién llegados'), 60, 1500);
    rec.mark('home-novedades');
    await rec.wait(700);
    // Guarda un producto en favoritos desde su tarjeta (corazón).
    await rec.click(page.getByRole('button', { name: 'Guardar Crema facial Demo en favoritos' }).first());
    rec.mark('fav-card');
    await rec.wait(1400);
    await rec.scrollToElement(heading('Productos destacados'), 60, 1500);
    rec.mark('home-destacados');
    await rec.wait(1700);
    await rec.scrollToElement(page.getByRole('heading', { name: /Tus marcas favoritas/ }).first(), 60, 1500);
    rec.mark('home-marcas');
    await rec.wait(1500);
    await rec.scrollToElement(heading('Precios especiales'), 40, 1500);
    rec.mark('home-ofertas');
    await rec.wait(1900);
    await rec.scrollToElement(page.getByRole('heading', { name: /Lo que dicen nuestras clientas/ }).first(), 60, 1800);
    rec.mark('home-testimonios');
    await rec.wait(1800);
    rec.mark('home-end');
    await rec.scrollTo(0, 1500);
    await rec.wait(400);

    // ── Escena 3 · Búsqueda, categorías y filtros ───────────────────────
    rec.mark('catalog');
    const search = page.getByPlaceholder('Buscar productos…').first();
    await rec.type(search, 'labial', 110);
    await rec.wait(350);
    await page.keyboard.press('Enter');
    await page.waitForURL(/q=labial/);
    await rec.settle();
    rec.mark('search-results');
    await rec.moveTo(900, 560, 800);
    await rec.wait(2200);
    await rec.click(page.getByRole('navigation', { name: 'Categorías' }).first().getByRole('link', { name: 'Ver todo', exact: true }));
    await page.waitForURL((u) => u.pathname === '/productos' && !u.search.includes('q='));
    await rec.settle();
    rec.mark('catalog-all');
    await rec.wait(900);
    await rec.scrollTo(300, 1200);
    await rec.wait(400);
    const sidebar = page.locator('aside').first();
    await rec.click(sidebar.getByRole('link', { name: 'Demo Labios', exact: true }));
    await page.waitForURL(/categoria=/);
    await rec.settle();
    rec.mark('filter-category');
    await rec.wait(1300);
    await rec.ensureScroll(300);
    await rec.click(sidebar.getByRole('link', { name: 'Demo Aurora', exact: true }));
    await page.waitForURL(/marca=/);
    await rec.settle();
    rec.mark('filter-brand');
    await rec.wait(1300);
    await rec.ensureScroll(300);
    await rec.click(sidebar.getByRole('link', { name: 'Solo ofertas', exact: true }));
    await page.waitForURL(/ofertas=1/);
    await rec.settle();
    rec.mark('filter-offers');
    await rec.wait(1600);

    // ── Escena 4 · Detalle del producto ─────────────────────────────────
    const card = page.getByRole('link', { name: 'Labial mate Demo', exact: true }).first();
    await rec.click(card);
    await page.waitForURL(/\/producto\/labial-mate-demo/);
    await rec.settle();
    rec.mark('detail');
    await rec.moveTo(980, 420, 900);
    await rec.wait(1300);
    await rec.click(page.getByRole('button', { name: /Tono Demo Rosa/ }).first());
    rec.mark('variant-1');
    await rec.wait(1500);
    await rec.click(page.getByRole('button', { name: /Tono Demo Vino/ }).first());
    rec.mark('variant-2');
    await rec.wait(1300);
    await rec.hover(page.getByRole('button', { name: /Tono Demo Ciruela/ }).first());
    rec.mark('variant-out');
    await rec.wait(1500);
    await rec.click(page.getByRole('button', { name: /Tono Demo Rosa/ }).first());
    await rec.wait(700);
    const plus = page.getByRole('button', { name: /^Aumentar cantidad/ }).first();
    await rec.click(plus);
    await rec.wait(450);
    await rec.press();
    rec.mark('quantity');
    await rec.wait(900);
    await rec.click(page.getByRole('button', { name: /Guardar en favoritos/ }).first());
    rec.mark('fav-detail');
    await rec.wait(1200);
    await rec.click(page.getByRole('button', { name: /Agregar a la bolsa/ }).first());
    rec.mark('add-to-bag');
    await rec.wait(2200);

    // ── Escena 5 · Favoritos y bolsa ────────────────────────────────────
    await rec.click(page.getByRole('link', { name: /^Favoritos, / }).first());
    await page.waitForURL(/\/favoritos/);
    await rec.settle();
    rec.mark('favorites');
    await rec.moveTo(760, 520, 800);
    await rec.wait(1500);
    await rec.click(page.getByRole('button', { name: 'Agregar Crema facial Demo a la bolsa' }).first());
    rec.mark('quick-add');
    await rec.wait(1600);
    await rec.click(page.getByRole('link', { name: /^Bolsa de compra/ }).first());
    await page.waitForURL(/\/carrito/);
    await rec.settle();
    rec.mark('cart');
    await rec.wait(1500);
    await rec.click(page.getByRole('button', { name: /^Aumentar cantidad/ }).last());
    await rec.wait(1300);
    await rec.click(page.getByRole('button', { name: /^Disminuir cantidad/ }).first());
    rec.mark('cart-updated');
    await rec.wait(1800);
    await rec.hover(page.getByText('Resumen de tu pedido').first());
    await rec.wait(1200);

    // ── Escena 6 · Checkout con datos ficticios ─────────────────────────
    await rec.click(page.locator('a[href="/checkout"]').first());
    await page.waitForURL(/\/checkout/);
    await rec.settle();
    rec.mark('checkout');
    await rec.wait(900);
    await rec.type(page.getByLabel('Nombre completo'), 'Clienta Demo Video', 75);
    await rec.type(page.getByLabel('Teléfono / WhatsApp'), '300 000 0099', 75);
    rec.mark('checkout-contact');
    await rec.scrollToElement(page.getByRole('heading', { name: 'Entrega' }), 120, 1100);
    await rec.choose(page.locator('#departmentCode'), 'La Guajira');
    await rec.wait(900);
    await rec.choose(page.locator('#municipalityCode'), 'Riohacha');
    await rec.wait(1200);
    await rec.type(page.getByLabel('Dirección'), 'Calle Ficticia 12 # 34-56', 60);
    rec.mark('checkout-delivery');
    await rec.wait(600);
    await rec.scrollToElement(page.locator('#payment-title'), 120, 1200);
    const firstMethod = page.locator('#paymentMethodId label').first();
    await rec.click(firstMethod, { dx: 0.15 });
    rec.mark('checkout-payment');
    await rec.wait(1500);
    await rec.scrollToElement(page.locator('#termsAccepted'), 260, 1100);
    await rec.click(page.locator('#termsAccepted'));
    await rec.wait(450);
    await rec.click(page.locator('#dataProcessingAccepted'));
    rec.mark('checkout-consent');
    await rec.wait(900);
    await rec.hover(page.getByText('Resumen de tu pedido').first());
    await rec.wait(1600);
    const submit = page.getByRole('button', { name: /Crear pedido/ });
    await rec.click(submit);
    await page.waitForURL(/\/pedido\//, { timeout: 20000 });
    await rec.settle();
    rec.mark('order-created');
    await rec.moveTo(720, 420, 900);
    await rec.wait(1800);
    await rec.hover(page.getByRole('link', { name: /Abrir WhatsApp/ }));
    rec.mark('whatsapp');
    await rec.wait(1800);
    const code = (await page.locator('strong[translate="no"]').first().innerText()).trim();

    // ── Escena 7 · Seguimiento sin cuenta ───────────────────────────────
    await rec.click(page.getByRole('link', { name: /Ver el estado de mi pedido/ }));
    await page.waitForURL(/\/seguimiento\//);
    await rec.settle();
    rec.mark('tracking');
    await rec.moveTo(900, 500, 900);
    await rec.wait(2200);
    await rec.scrollTo(420, 1600);
    rec.mark('tracking-detail');
    await rec.wait(2400);
    rec.mark('end');
    await rec.wait(300);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(ORDER_FILE, JSON.stringify({ code }, null, 1));
    console.log(`  · Pedido de prueba creado: ${code}`);
  } finally {
    await rec.close();
    await browser.close();
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  await captureStore();
}
