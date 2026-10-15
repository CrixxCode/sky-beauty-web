// Línea de tiempo del video, construida a partir de las marcas que dejó cada grabación.
// Si se vuelve a grabar, los tiempos se recalculan solos: todo se ancla a marcas con nombre.
//
// Coordenadas de cámara: píxeles del cuadro capturado (1920×1080). s = acercamiento.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/env.mjs';

export const FPS = 30;
const metas = {};
export function meta(clip) {
  metas[clip] ??= JSON.parse(readFileSync(path.join(ROOT, 'recordings', clip, 'meta.json'), 'utf8'));
  return metas[clip];
}
const mk = (clip, mark, off = 0) => {
  const t = meta(clip).marks[mark];
  if (t === undefined) throw new Error(`Falta la marca ${clip}:${mark}`);
  return t + off;
};

export function buildTimeline() {
  let T = 0;
  const shots = [];
  const captions = [];
  const cams = [];
  const sfx = [];
  const phoneShots = [];

  /** Toma: tramos [desde, hasta] del clip con su velocidad, empezando en el tiempo `start`. */
  function shot(clip, parts, { start = T, fade = 0.5, list = shots, layout = 'window' } = {}) {
    let t = start;
    const map = parts.map(([a, b, rate = 1]) => {
      const s0 = Array.isArray(a) ? mk(clip, ...a) : a;
      const s1 = Array.isArray(b) ? mk(clip, ...b) : b;
      const seg = { T0: t, T1: t + (s1 - s0) / rate, s0, s1, rate };
      t = seg.T1;
      return seg;
    });
    const s = { id: `${clip}-${list.length}`, clip, layout, t0: start, t1: t, fade, map };
    list.push(s);
    return s;
  }
  /** Tiempo del video en que ocurre el instante `clipTime` de la toma. */
  const out = (s, clipTime) => {
    for (const m of s.map) if (clipTime >= m.s0 - 1e-6 && clipTime <= m.s1 + 1e-6) return m.T0 + (clipTime - m.s0) / m.rate;
    return null;
  };
  const at = (s, mark, off = 0) => out(s, mk(s.clip, mark, off));
  /** Mueve la cámara para llegar a (s, x, y) en el tiempo T, en d segundos. */
  const cam = (Tend, s, x = 960, y = 540, d = 0.9) => Tend !== null && cams.push({ T: Tend, d, s, x, y });
  const caption = (T0, T1, eyebrow, title, sub = '') => captions.push({ T0, T1, eyebrow, title, sub });

  // ── 1 · Introducción ──────────────────────────────────────────────────
  const INTRO_OUT = 5.9; // la introducción se retira y entra la ventana
  sfx.push({ T: 0.45, kind: 'logo' });

  // ── 2 · Inicio ────────────────────────────────────────────────────────
  const home = shot('store', [
    [['home', 0.3], ['home-scroll'], 1.0],
    [['home-scroll'], ['home-end'], 1.6],
  ], { start: INTRO_OUT, fade: 0 });
  T = home.t1;
  const S2 = home.t0 + 1.0;
  caption(S2, at(home, 'home-categorias'), 'La tienda', 'Descubre tu próxima inspiración', 'Novedades, destacados y ofertas en el inicio');
  caption(at(home, 'home-categorias'), at(home, 'home-ofertas', -0.3), 'Catálogo', 'Explora por tipo de producto', 'Categorías, novedades y favoritos desde cada tarjeta');
  caption(at(home, 'home-ofertas', -0.3), home.t1 + 0.2, 'Promociones', 'Precios especiales, siempre claros', 'Precio regular, descuento y precio final');
  cam(at(home, 'home', 2.2), 1.18, 560, 470, 2.2); // acercamiento lento al titular
  cam(at(home, 'home-scroll', -0.1), 1, 960, 540, 0.8); // vuelve antes del scroll
  cam(at(home, 'fav-card', -0.5), 1.28, 1500, 560, 0.7); // corazón de la tarjeta
  cam(at(home, 'home-destacados', -0.2), 1, 960, 540, 0.6);

  // ── 3 · Búsqueda y filtros ────────────────────────────────────────────
  const store = shot('store', [
    [['catalog'], ['search-results'], 1.25],
    [['search-results'], ['detail', -0.3], 1.45],
    [['detail', -0.3], ['add-to-bag', 2.0], 1.25],
    [['add-to-bag', 2.0], ['checkout'], 1.45],
    [['checkout'], ['order-created'], 2.0],
    [['order-created'], ['tracking'], 1.05],
    [['tracking'], ['end'], 1.15],
  ], { start: T - 0.5, fade: 0.5 });
  T = store.t1;
  sfx.push({ T: store.t0, kind: 'whoosh' });
  caption(store.t0 + 0.3, at(store, 'catalog-all'), 'Búsqueda', 'Encuentra exactamente lo que buscas', 'Sin importar tildes ni mayúsculas');
  caption(at(store, 'catalog-all'), at(store, 'detail'), 'Filtros', 'Categorías, marcas y ofertas', 'Los filtros se combinan entre sí');
  cam(at(store, 'catalog', 0.3), 1.5, 960, 150, 0.9); // buscador del encabezado
  cam(at(store, 'search-results', -0.2), 1, 960, 540, 0.7);
  cam(at(store, 'filter-category', -1.6), 1.3, 620, 560, 0.8); // barra lateral de filtros
  cam(at(store, 'filter-offers', 1.0), 1, 960, 540, 0.7);

  // ── 4 · Detalle del producto ─────────────────────────────────────────
  caption(at(store, 'detail'), at(store, 'quantity', -0.4), 'Detalle del producto', 'Cada tono, con su disponibilidad', 'La galería cambia con la variante · los agotados se indican');
  caption(at(store, 'quantity', -0.4), at(store, 'favorites'), 'Detalle del producto', 'Elige la cantidad y agrega a la bolsa', 'Respeta las existencias de cada variante');
  cam(at(store, 'detail', 1.2), 1.3, 1420, 560, 0.9); // variantes
  cam(at(store, 'add-to-bag', 1.2), 1, 960, 540, 0.8);

  // ── 5 · Favoritos y bolsa ────────────────────────────────────────────
  caption(at(store, 'favorites'), at(store, 'cart'), 'Favoritos', 'Tus favoritos en un solo lugar', 'Se guardan en el navegador, sin crear cuenta');
  caption(at(store, 'cart'), at(store, 'checkout'), 'Bolsa de compra', 'Tu selección, siempre al día', 'Cantidades, descuentos y subtotal al instante');
  cam(at(store, 'favorites', 0.6), 1.12, 900, 520, 0.8);
  cam(at(store, 'cart', -0.2), 1, 960, 540, 0.6);
  cam(at(store, 'cart-updated', 0.2), 1.22, 1250, 520, 0.8);
  cam(at(store, 'checkout', -0.4), 1, 960, 540, 0.6);

  // ── 6 · Checkout ─────────────────────────────────────────────────────
  caption(at(store, 'checkout'), at(store, 'order-created'), 'Checkout', 'Compra de manera sencilla', 'Datos de entrega, envío según el municipio y método de pago');
  caption(at(store, 'order-created'), at(store, 'tracking'), 'Pedido registrado', 'El pedido continúa por WhatsApp', 'Código y resumen listos para enviar a la tienda');
  cam(at(store, 'checkout', 1.0), 1.22, 760, 470, 0.9);
  cam(at(store, 'checkout-consent', 0.6), 1, 960, 540, 0.6);
  cam(at(store, 'order-created', 0.9), 1.32, 960, 460, 0.9);
  cam(at(store, 'tracking', -0.3), 1, 960, 540, 0.6);
  sfx.push({ T: at(store, 'order-created', 0.15), kind: 'success' });

  // ── 7 · Seguimiento sin cuenta (en lugar de "cuenta del cliente") ─────
  caption(at(store, 'tracking'), store.t1 + 0.3, 'Sin cuentas ni contraseñas', 'Sigue tu pedido con un enlace privado', 'También con el código del pedido y el teléfono');
  cam(at(store, 'tracking', 1.0), 1.18, 960, 470, 1.0);
  cam(at(store, 'tracking-detail', -1.4), 1, 960, 540, 0.8);

  // ── 8 · Panel administrativo ─────────────────────────────────────────
  const login = shot('login', [[['login', 0.2], ['end', -0.2], 1.0]], { start: T - 0.6, fade: 0.6 });
  sfx.push({ T: login.t0, kind: 'whoosh' });
  T = login.t1;
  const admin = shot('admin', [
    [['dashboard', 0.1], ['orders'], 1.25],
    [['orders'], ['products'], 1.6],
    [['products'], ['product-info', 1.2], 1.5],
  ], { start: T - 0.5, fade: 0.5 });
  T = admin.t1;
  const admin2 = shot('admin', [
    [['inventory', -0.2], ['promotions'], 1.4],
    [['promotions'], ['reports'], 1.5],
    [['reports'], ['end'], 1.4],
  ], { start: T - 0.4, fade: 0.4 });
  T = admin2.t1;
  caption(login.t0 + 0.4, at(admin, 'orders'), 'Panel administrativo', 'Control total de tu negocio', 'Acceso restringido · pendientes del día y ventas');
  caption(at(admin, 'orders'), at(admin, 'products'), 'Pedidos', 'Gestiona todos tus pedidos', 'Confirma, cotiza el envío y sigue cada estado');
  caption(at(admin, 'products'), admin.t1, 'Catálogo', 'Productos con variantes y fotos', 'Precios, tonos, existencias y publicación');
  caption(admin2.t0, at(admin2, 'promotions'), 'Inventario', 'Existencias por variante', 'Entradas, ajustes y alertas de stock bajo');
  caption(at(admin2, 'promotions'), at(admin2, 'reports'), 'Promociones', 'Descuentos con fecha de inicio y fin', 'Por variante, producto o categoría');
  caption(at(admin2, 'reports'), admin2.t1 + 0.3, 'Reportes', 'Ventas, más vendidos y márgenes', 'Exportables a CSV');
  cam(at(admin, 'dashboard', 1.2), 1.16, 1080, 620, 1.4);
  cam(at(admin, 'orders', -0.3), 1, 960, 540, 0.6);
  cam(at(admin, 'order-detail', 0.4), 1.15, 960, 520, 0.8);
  cam(at(admin, 'order-confirmed', 1.6), 1, 960, 540, 0.6);
  cam(at(admin, 'product-manage', 0.3), 1.12, 960, 560, 0.8);
  cam(at(admin, 'product-info', 0.9), 1, 960, 540, 0.4);
  cam(at(admin2, 'inventory-low', 0.2), 1.2, 820, 560, 0.8);
  cam(at(admin2, 'promotions', -0.3), 1, 960, 540, 0.6);
  cam(at(admin2, 'reports-top', -0.2), 1.15, 1050, 640, 0.8);
  sfx.push({ T: admin2.t0, kind: 'whoosh' });

  // ── 9 · Responsive ───────────────────────────────────────────────────
  const R0 = T - 0.2;
  const desk = shot('store', [[['home', 0.4], ['home-novedades', 1.2], 1.0]], { start: R0, fade: 0.5, layout: 'desk' });
  const phone = shot('mobile', [[['home', 0.2], ['added', 1.0], 1.6]], { start: R0 + 0.6, fade: 0, list: phoneShots });
  const R1 = Math.max(desk.t1, phone.t1) - 0.3;
  desk.t1 = Math.max(desk.t1, R1 + 1.4);
  phone.t1 = Math.max(phone.t1, R1 + 1.4);
  caption(R0 + 0.4, R1, 'Responsive', 'Una experiencia para cada pantalla', 'Pensada primero para el celular');
  sfx.push({ T: R0, kind: 'whoosh' });
  T = R1;

  // ── 10 · Cierre ──────────────────────────────────────────────────────
  const OUTRO = T;
  sfx.push({ T: OUTRO + 1.1, kind: 'outro' });

  // ── 11 · Crédito del desarrollo (imagen oficial a pantalla completa) ──
  const CREDIT = OUTRO + 5.6; // entra cuando el logotipo y el lema ya se leyeron
  const DURATION = CREDIT + 5.0;
  sfx.push({ T: CREDIT + 0.7, kind: 'credit' });

  // Clics reales de las grabaciones → sonido de clic suave.
  for (const s of [...shots, ...phoneShots]) {
    if (s.layout === 'desk') continue;
    for (const c of meta(s.clip).clicks) {
      const t = out(s, c.t);
      if (t !== null && t > s.t0 + s.fade && t < s.t1 - 0.1) sfx.push({ T: t, kind: s.clip === 'mobile' ? 'tap' : 'click' });
    }
  }

  // Ruta visible en la barra de la ventana (el token de seguimiento se oculta).
  const urls = [];
  for (const s of shots) {
    const list = meta(s.clip).urls;
    const first = [...list].reverse().find((u) => u.t <= s.map[0].s0) ?? list[0];
    urls.push({ T: s.t0, url: first.url, shot: s.id });
    for (const u of list) {
      const t = out(s, u.t);
      if (t !== null && t > s.t0) urls.push({ T: t, url: u.url, shot: s.id });
    }
  }
  for (const u of urls) {
    const p = new URL(u.url);
    u.path = decodeURIComponent(p.pathname + p.search)
      .replace(/\/seguimiento\/[^/?#]+/, '/seguimiento/••••••••')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '…');
  }

  cams.sort((a, b) => a.T - b.T);
  sfx.sort((a, b) => a.T - b.T);
  return {
    fps: FPS,
    duration: DURATION,
    introOut: INTRO_OUT,
    responsive: { R0, R1 },
    outro: OUTRO,
    credit: CREDIT,
    shots,
    phoneShots,
    captions,
    cams,
    sfx,
    urls,
  };
}

/** Datos de cuadros de cada clip para el compositor (tiempos y archivos). */
export function clipFrames(clips) {
  const outData = {};
  for (const c of clips) {
    const m = meta(c);
    outData[c] = { t: m.frames.map((f) => f.t), f: m.frames.map((f) => f.file), w: m.viewport };
  }
  return outData;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const tl = buildTimeline();
  const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  console.log(`Duración: ${fmt(tl.duration)} (${tl.duration.toFixed(1)} s)`);
  for (const s of [...tl.shots, ...tl.phoneShots]) console.log(`  toma ${s.id.padEnd(9)} ${fmt(s.t0)} → ${fmt(s.t1)}`);
  for (const c of tl.captions) console.log(`  ${fmt(c.T0)}–${fmt(c.T1)}  ${c.title}`);
  console.log(`  Responsive ${fmt(tl.responsive.R0)} · Cierre ${fmt(tl.outro)} · Crédito ${fmt(tl.credit)} · ${tl.sfx.length} sonidos`);
}
