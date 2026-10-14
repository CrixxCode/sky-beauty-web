// Recorrido corto de la tienda en celular (390×844, táctil) para la escena responsive.
import path from 'node:path';
import { ROOT } from './lib/env.mjs';
import { launch, newContext, MOBILE } from './lib/session.mjs';
import { Recorder } from './lib/recorder.mjs';

export async function captureMobile() {
  const browser = await launch(MOBILE);
  const ctx = await newContext(browser, MOBILE);
  const rec = new Recorder(ctx, { name: 'mobile', dir: path.join(ROOT, 'recordings'), mode: 'touch', scale: MOBILE.scale });
  rec.pos = { x: 300, y: 600 };
  const page = await rec.open('/');
  try {
    rec.mark('home');
    await rec.wait(2200);
    await rec.click(page.getByRole('button', { name: 'Abrir menú' }));
    rec.mark('menu');
    await rec.wait(1800);
    await page.keyboard.press('Escape');
    await rec.wait(700);
    await rec.scrollToElement(page.getByRole('heading', { name: 'Explora por tipo de producto' }).first(), 70, 1300);
    rec.mark('categories');
    await rec.wait(1300);
    await rec.scrollToElement(page.getByRole('heading', { name: 'Productos destacados' }).first(), 70, 1300);
    rec.mark('featured');
    await rec.wait(1300);
    await rec.click(page.getByRole('link', { name: 'Labial mate Demo', exact: true }).first());
    await page.waitForURL(/\/producto\/labial-mate-demo/);
    await rec.settle();
    rec.mark('detail');
    await rec.wait(1300);
    await rec.scrollTo(380, 1200);
    await rec.wait(500);
    await rec.click(page.getByRole('button', { name: /Tono Demo Rosa/ }).first());
    rec.mark('variant');
    await rec.wait(1300);
    await rec.click(page.getByRole('button', { name: /Agregar a la bolsa/ }).first());
    rec.mark('added');
    await rec.wait(1800);
    rec.mark('end');
  } finally {
    await rec.close();
    await browser.close();
  }
}
