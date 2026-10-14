// Navegador y contextos de grabación con la configuración de video.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO, SITE } from './env.mjs';

/**
 * Escritorio: 1440×810 CSS px renderizados a 1,333x → cuadros nativos de 1920×1080.
 * El screencast de Chrome ignora el deviceScaleFactor emulado, así que la escala se fuerza en el
 * proceso del navegador (--force-device-scale-factor) y el viewport se fija en la página.
 */
export const DESKTOP = { scale: 4 / 3, size: { width: 1440, height: 810 }, context: {} };
/** Celular: 390×844 CSS px (un iPhone actual) a 2x → cuadros de 780×1688. */
export const MOBILE = { scale: 2, size: { width: 390, height: 844 }, context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };

function internalKey() {
  const line = readFileSync(path.join(REPO, 'backend', '.env'), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('INTERNAL_API_KEY='));
  return line?.slice('INTERNAL_API_KEY='.length).replace(/^["']|["']$/g, '');
}

export async function launch(device = DESKTOP) {
  return chromium.launch({
    channel: 'chromium',
    args: [`--force-device-scale-factor=${device.scale}`, '--hide-scrollbars', '--font-render-hinting=none'],
  });
}

/**
 * Contexto de grabación. La clave interna (solo en local) evita que el límite de peticiones por
 * IP del backend corte la grabación: todas las peticiones del navegador llegan desde la misma IP.
 */
export async function newContext(browser, device, extra = {}) {
  const key = internalKey();
  const context = await browser.newContext({
    viewport: null,
    ...device.context,
    baseURL: SITE,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    extraHTTPHeaders: key ? { 'x-internal-api-key': key } : {},
    ...extra,
  });
  context.__size = device.size;
  return context;
}
