// Grabación de recorridos reales con Playwright.
//
// - Graba con el screencast de Chrome (CDP): cuadros JPEG de alta calidad con su marca de tiempo.
//   build-clips.mjs los convierte luego a una secuencia de 30 fps constantes.
// - Inyecta un cursor visible (los navegadores sin interfaz no lo dibujan) con onda al hacer clic,
//   o un punto de toque en celular. Es solo una capa visual: no cambia la página.
// - Difumina el correo de la cuenta del panel para que no aparezca en el video.
// - Registra marcas (eventos con nombre), clics y la ruta visible en cada momento.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const OVERLAY = String.raw`
(() => {
  if (window.__vidOverlay) return;
  window.__vidOverlay = true;
  const MODE = '__MODE__';
  const css = document.createElement('style');
  css.textContent = ${'`'}
    #vid-cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;
      transform:translate(-100px,-100px);transition:none;will-change:transform}
    #vid-cursor svg{display:block;filter:drop-shadow(0 2px 3px rgba(40,20,40,.35));transform-origin:3px 2px;transition:transform .09s ease-out}
    #vid-cursor.down svg{transform:scale(.84)}
    #vid-touch{position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
      background:rgba(255,255,255,.55);border:2px solid rgba(112,67,111,.55);box-shadow:0 2px 10px rgba(58,44,54,.25);
      z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .18s ease-out}
    .vid-ripple{position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;
      border:2px solid rgba(164,110,164,.85);width:12px;height:12px;margin:-6px 0 0 -6px;
      animation:vidRip .62s cubic-bezier(.22,.8,.3,1) forwards}
    .vid-ripple.r2{border-color:rgba(183,133,184,.55);animation-delay:.1s;opacity:0}
    @keyframes vidRip{0%{transform:scale(1);opacity:1}100%{transform:scale(6.2);opacity:0}}
    [data-vid-private]{filter:blur(5px)!important}
  ${'`'};
  const mount = () => {
    if (!document.body) return requestAnimationFrame(mount);
    document.head.appendChild(css);
    if (MODE === 'touch') {
      const t = document.createElement('div'); t.id = 'vid-touch'; document.body.appendChild(t);
    } else {
      const c = document.createElement('div'); c.id = 'vid-cursor';
      c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8 16.5 L11.4 24 L14.6 22.6 L11.3 15.3 L18 15.3 Z" fill="#2b2028" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      document.body.appendChild(c);
      const p = JSON.parse(sessionStorage.getItem('vid-cursor') || 'null');
      if (p) c.style.transform = 'translate(' + p[0] + 'px,' + p[1] + 'px)';
    }
    // Privacidad: difumina correos y números de 7 o más dígitos (teléfonos, cuentas, Nequi…).
    const hide = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const v = n.nodeValue || '';
        if ((/[\w.+-]+@[\w-]+\.[\w.]+/.test(v) || /\d{7,}/.test(v.replace(/\s/g, ''))) && n.parentElement && !n.parentElement.closest('input,textarea')) {
          n.parentElement.setAttribute('data-vid-private', '');
        }
      }
      // Enlaces privados de seguimiento (llevan un token) en campos de solo lectura.
      for (const input of document.querySelectorAll('input')) {
        if (/\/seguimiento\//.test(input.value)) input.setAttribute('data-vid-private', '');
      }
    };
    setInterval(hide, 250);
    hide();
    new MutationObserver(hide).observe(document.body, { subtree: true, childList: true, characterData: true });
  };
  mount();
  window.__vidMove = (x, y) => {
    const c = document.getElementById('vid-cursor');
    if (c) c.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    const t = document.getElementById('vid-touch');
    if (t) { t.style.left = x + 'px'; t.style.top = y + 'px'; }
    try { sessionStorage.setItem('vid-cursor', JSON.stringify([x, y])); } catch {}
  };
  window.__vidPress = (down, x, y) => {
    const c = document.getElementById('vid-cursor');
    if (c) c.classList.toggle('down', down);
    const t = document.getElementById('vid-touch');
    if (t) t.style.opacity = down ? '1' : '0';
    if (down) {
      for (const cls of ['vid-ripple', 'vid-ripple r2']) {
        const r = document.createElement('div'); r.className = cls;
        r.style.left = x + 'px'; r.style.top = y + 'px';
        document.body.appendChild(r); setTimeout(() => r.remove(), 900);
      }
    }
  };
})();
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Recorder {
  /**
   * @param {import('playwright').BrowserContext} context
   * @param {{ name: string, dir: string, mode?: 'mouse'|'touch', extraHeaders?: Record<string,string> }} opts
   */
  constructor(context, { name, dir, mode = 'mouse', scale = 4 / 3 }) {
    this.scale = scale;
    this.context = context;
    this.name = name;
    this.dir = path.join(dir, name);
    this.mode = mode;
    this.frames = [];
    this.marks = {};
    this.clicks = [];
    this.urls = [];
    this.pending = [];
    this.pos = { x: 720, y: 450 };
  }

  async open(url) {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(path.join(this.dir, 'raw'), { recursive: true });
    await this.context.addInitScript(OVERLAY.replace('__MODE__', this.mode));
    this.page = await this.context.newPage();
    if (this.context.__size) await this.page.setViewportSize(this.context.__size);
    this.errors = [];
    this.page.on('pageerror', (e) => this.errors.push(e.message));
    this.page.on('response', (r) => {
      if (r.status() >= 500 || r.status() === 429) this.errors.push(`${r.status()} ${r.url()}`);
    });
    // Página inicial cargada antes de empezar a grabar: el clip no arranca en blanco.
    await this.page.goto(url, { waitUntil: 'networkidle' });
    await this.settle();
    await this.page.evaluate(([x, y]) => window.__vidMove?.(x, y), [this.pos.x, this.pos.y]);
    this.page.on('framenavigated', (f) => {
      if (f === this.page.mainFrame() && this.startedAt) this.urls.push({ t: this.now(), url: f.url() });
    });
    const vp = this.page.viewportSize();
    const dpr = this.scale;
    this.cdp = await this.context.newCDPSession(this.page);
    let index = 0;
    this.cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      // Mismo reloj (hora del sistema) para cuadros, marcas y clics.
      if (!this.startedAt) this.startedAt = metadata.timestamp * 1000;
      const file = `raw/${String(index++).padStart(6, '0')}.jpg`;
      this.frames.push({ file, t: (metadata.timestamp * 1000 - this.startedAt) / 1000 });
      this.pending.push(writeFile(path.join(this.dir, file), Buffer.from(data, 'base64')));
    });
    await this.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 93,
      maxWidth: Math.round(vp.width * dpr),
      maxHeight: Math.round(vp.height * dpr),
      everyNthFrame: 1,
    });
    // Espera el primer cuadro para fijar el tiempo cero.
    while (!this.startedAt) await sleep(20);
    this.urls.push({ t: 0, url: this.page.url() });
    // Un "latido" de 1 px fuera de la vista obliga a Chrome a seguir enviando cuadros en pausas.
    await this.page.evaluate(() => {
      const hb = document.createElement('div');
      hb.style.cssText = 'position:fixed;left:-2px;top:-2px;width:1px;height:1px;z-index:-1;pointer-events:none';
      document.documentElement.appendChild(hb);
      let on = false;
      setInterval(() => { on = !on; hb.style.background = on ? '#fff' : '#fffffe'; }, 33);
    }).catch(() => {});
    return this.page;
  }

  now() {
    return (Date.now() - this.startedAt) / 1000;
  }

  mark(name) {
    this.marks[name] = this.now();
  }

  async wait(ms) {
    await sleep(ms);
  }

  async settle() {
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.evaluate(() => document.fonts.ready).catch(() => {});
    await sleep(250);
  }

  async ensureOverlay() {
    await this.page.evaluate(OVERLAY.replace('__MODE__', this.mode)).catch(() => {});
    await this.page.evaluate(([x, y]) => window.__vidMove?.(x, y), [this.pos.x, this.pos.y]).catch(() => {});
  }

  /** Mueve el cursor en arco hasta (x, y), con aceleración y frenado suaves. */
  async moveTo(x, y, ms) {
    const from = { ...this.pos };
    const dist = Math.hypot(x - from.x, y - from.y);
    const duration = ms ?? Math.min(1100, Math.max(380, dist * 0.9));
    const steps = Math.max(8, Math.round(duration / 16));
    // Punto de control desplazado en perpendicular: trayectoria curva como la de una mano.
    const mx = (from.x + x) / 2 - (y - from.y) * 0.12;
    const my = (from.y + y) / 2 + (x - from.x) * 0.12;
    const t0 = Date.now();
    for (let i = 1; i <= steps; i++) {
      const target = t0 + (duration * i) / steps;
      const k = easeInOut(i / steps);
      const px = (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * mx + k * k * x;
      const py = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * my + k * k * y;
      if (this.mode === 'mouse') await this.page.mouse.move(px, py);
      await this.page.evaluate(([a, b]) => window.__vidMove?.(a, b), [px, py]).catch(() => {});
      const left = target - Date.now();
      if (left > 0) await sleep(left);
    }
    this.pos = { x, y };
  }

  async box(locator) {
    await locator.waitFor({ state: 'visible', timeout: 15000 });
    const b = await locator.boundingBox();
    if (!b) throw new Error(`Sin caja para ${locator}`);
    return b;
  }

  /** Lleva el cursor al elemento; si está fuera de la vista, primero hace un scroll suave. */
  async hover(locator, { dx = 0.5, dy = 0.5, ms } = {}) {
    let b = await this.box(locator);
    const vp = this.page.viewportSize();
    if (b.y < 70 || b.y + b.height > vp.height - 40) {
      const y = await this.page.evaluate(() => window.scrollY);
      await this.scrollTo(y + b.y - vp.height * 0.4, 1000);
      await sleep(250);
      b = await this.box(locator);
    }
    await this.moveTo(b.x + b.width * dx, b.y + b.height * dy, ms);
    return b;
  }

  /** Clic visible: mueve, presiona con onda, suelta. */
  async click(locator, opts = {}) {
    await this.hover(locator, opts);
    await sleep(opts.pause ?? 160);
    await this.press();
  }

  async press() {
    const { x, y } = this.pos;
    this.clicks.push({ t: this.now(), x, y });
    await this.page.evaluate(([a, b]) => window.__vidPress?.(true, a, b), [x, y]).catch(() => {});
    if (this.mode === 'touch') {
      await this.page.touchscreen.tap(x, y);
    } else {
      await this.page.mouse.down();
      await sleep(70);
      await this.page.mouse.up();
    }
    await this.page.evaluate(([a, b]) => window.__vidPress?.(false, a, b), [x, y]).catch(() => {});
  }

  /** Abre un selector (Radix) y elige la opción visible con ese nombre. */
  async choose(trigger, optionName) {
    await this.click(trigger);
    await sleep(450);
    const option = this.page.getByRole('option', { name: optionName, exact: true });
    await option.waitFor({ state: 'attached', timeout: 15000 });
    // Se desplaza la lista con la rueda del ratón, sobre la lista (desplazar la página la cierra).
    const lb = await this.page.getByRole('listbox').boundingBox();
    await this.moveTo(lb.x + lb.width * 0.5, lb.y + lb.height * 0.5, 450);
    for (let i = 0; i < 120; i++) {
      const [er, vr] = await option.evaluate((el) => {
        const vp = el.closest('[data-radix-select-viewport]') ?? el.parentElement;
        const r = (x) => { const q = x.getBoundingClientRect(); return { top: q.top, bottom: q.bottom }; };
        return [r(el), r(vp)];
      });
      const center = (er.top + er.bottom) / 2;
      const want = (vr.top + vr.bottom) / 2;
      if (center > vr.top + 30 && center < vr.bottom - 30 && Math.abs(center - want) < 40) break;
      const delta = Math.max(-90, Math.min(90, center - want));
      await this.page.mouse.wheel(0, delta);
      await sleep(28);
    }
    await sleep(300);
    const b = await option.boundingBox();
    await this.moveTo(b.x + b.width * 0.3, b.y + b.height / 2, 550);
    await sleep(200);
    await this.press();
  }

  /** Escribe como una persona: ritmo de ~90 ms por carácter. */
  async type(locator, text, delay = 85) {
    await this.click(locator);
    await sleep(180);
    await locator.pressSequentially(text, { delay });
  }

  /** Scroll suave hasta y (o dentro de un contenedor), con frenado. */
  async scrollTo(y, ms = 1400, selector = null) {
    await this.page.evaluate(
      async ([target, duration, sel]) => {
        const el = sel ? document.querySelector(sel) : null;
        const get = () => (el ? el.scrollTop : window.scrollY);
        const set = (v) => (el ? (el.scrollTop = v) : window.scrollTo(0, v));
        const start = get();
        const max = (el ? el.scrollHeight - el.clientHeight : document.documentElement.scrollHeight - innerHeight);
        const end = Math.max(0, Math.min(max, target));
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const t0 = performance.now();
        await new Promise((done) => {
          const step = (now) => {
            const k = Math.min(1, (now - t0) / duration);
            set(start + (end - start) * ease(k));
            if (k < 1) requestAnimationFrame(step); else done();
          };
          requestAnimationFrame(step);
        });
      },
      [y, ms, selector],
    );
  }

  /** Si la página quedó arriba (p. ej. tras navegar), vuelve suavemente a `y`. */
  async ensureScroll(y, ms = 1000) {
    const now = await this.page.evaluate(() => window.scrollY);
    if (Math.abs(now - y) > 60) await this.scrollTo(y, ms);
  }

  /** Scroll suave dentro del primer contenedor desplazable de `root` (p. ej. un diálogo). */
  async scrollWithin(root, delta, ms = 1300) {
    const handle = await root.evaluateHandle((el) => {
      const all = [el, ...el.querySelectorAll('*')];
      return all.find((n) => n.scrollHeight > n.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) ?? null;
    });
    await this.page.evaluate(
      async ([el, d, duration]) => {
        if (!el) return;
        const start = el.scrollTop;
        const end = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, start + d));
        const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
        const t0 = performance.now();
        await new Promise((done) => {
          const step = (now) => {
            const k = Math.min(1, (now - t0) / duration);
            el.scrollTop = start + (end - start) * ease(k);
            if (k < 1) requestAnimationFrame(step); else done();
          };
          requestAnimationFrame(step);
        });
      },
      [handle, delta, ms],
    );
  }

  /** Scroll suave para dejar el elemento a `offset` px del borde superior. */
  async scrollToElement(locator, offset = 140, ms = 1400) {
    await locator.waitFor({ state: 'attached', timeout: 15000 });
    const top = await locator.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await this.scrollTo(top - offset, ms);
  }

  async close() {
    await this.cdp.send('Page.stopScreencast').catch(() => {});
    await Promise.all(this.pending);
    const duration = this.now();
    writeFileSync(
      path.join(this.dir, 'meta.json'),
      JSON.stringify(
        {
          name: this.name,
          duration,
          viewport: this.page.viewportSize(),
          frames: this.frames,
          marks: this.marks,
          clicks: this.clicks,
          urls: this.urls,
          errors: this.errors,
        },
        null,
        1,
      ),
    );
    await this.page.close();
    if (this.errors.length) console.warn(`  ⚠ ${this.name}: ${this.errors.join(' | ')}`);
    console.log(`  ✓ ${this.name}: ${duration.toFixed(1)} s, ${this.frames.length} cuadros`);
  }
}
