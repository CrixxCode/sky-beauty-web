// Renderiza el montaje cuadro por cuadro (30 fps, 1920×1080) y lo codifica en H.264.
//
// Uso:
//   node scripts/render.mjs                      → output/video-sin-audio.mp4 (en paralelo)
//   node scripts/render.mjs --preview 3 40.5 95  → PNG de esos segundos en screenshots/preview/
//   node scripts/render.mjs --workers 4
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ffmpeg from 'ffmpeg-static';
import { ROOT } from './lib/env.mjs';
import { buildTimeline, clipFrames } from './timeline.mjs';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const tl = buildTimeline();
const clips = [...new Set([...tl.shots, ...tl.phoneShots].map((s) => s.clip))];
const frames = clipFrames(clips);
const OUT = path.join(ROOT, 'output');
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(ROOT, 'scenes', 'timeline.json'), JSON.stringify(tl, null, 1));

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(ROOT, 'scenes', 'compositor.html')).href, { waitUntil: 'networkidle' });
  const fontsOk = await page.evaluate(
    async ([t, f, base]) => {
      await Promise.all([
        document.fonts.load('500 48px "Playfair Display"'),
        document.fonts.load('italic 400 40px "Playfair Display"'),
        document.fonts.load('400 16px Poppins'),
        document.fonts.load('500 16px Poppins'),
        document.fonts.load('600 13px Poppins'),
      ]);
      return window.setup(t, f, base);
    },
    [tl, frames, '../recordings/'],
  );
  if (!fontsOk) throw new Error('No cargaron las tipografías (Playfair Display / Poppins). ¿Hay conexión a internet?');
  const cdp = await page.context().newCDPSession(page);
  return { page, cdp, errors };
}

async function draw({ page, cdp }, T, format = 'jpeg') {
  // renderFrame espera a que las imágenes estén decodificadas; la captura fuerza un cuadro nuevo.
  await page.evaluate((t) => window.renderFrame(t), T);
  const { data } = await cdp.send('Page.captureScreenshot', format === 'png' ? { format: 'png' } : { format: 'jpeg', quality: 95, optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

const browser = await chromium.launch();

if (args.includes('--preview')) {
  const times = args.slice(args.indexOf('--preview') + 1).filter((a) => !a.startsWith('--')).map(Number);
  const dir = path.join(ROOT, 'screenshots', 'preview');
  mkdirSync(dir, { recursive: true });
  const ctx = await openPage(browser);
  for (const t of times) {
    const file = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`);
    writeFileSync(file, await draw(ctx, t, 'png'));
    console.log(file);
  }
  if (ctx.errors.length) console.warn(ctx.errors);
  await browser.close();
  process.exit(0);
}

// Render completo en paralelo: cada proceso codifica un tramo y luego se concatenan sin recodificar.
const total = Math.round(tl.duration * tl.fps);
const workers = Number(flag('--workers', 4));
const per = Math.ceil(total / workers);
const tmp = path.join(ROOT, 'recordings', 'render-parts');
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
const started = Date.now();
let done = 0;

async function renderPart(w) {
  const from = w * per;
  const to = Math.min(total, from + per);
  const file = path.join(tmp, `part-${w}.mp4`);
  const enc = spawn(ffmpeg, [
    '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(tl.fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-tune', 'stillimage', '-g', '60', '-r', String(tl.fps), file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ctx = await openPage(browser);
  for (let i = from; i < to; i++) {
    const buf = await draw(ctx, i / tl.fps);
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
    done++;
    if (done % 150 === 0) {
      const el = (Date.now() - started) / 1000;
      console.log(`  ${done}/${total} cuadros · ${el.toFixed(0)} s · faltan ~${((el / done) * (total - done)).toFixed(0)} s`);
    }
  }
  enc.stdin.end();
  await new Promise((r, j) => enc.on('close', (c) => (c === 0 ? r() : j(new Error(`ffmpeg ${c}`)))));
  if (ctx.errors.length) console.warn(`  ⚠ errores en la página: ${ctx.errors.join(' | ')}`);
  return file;
}

console.log(`Renderizando ${total} cuadros (${tl.duration.toFixed(1)} s) con ${workers} procesos…`);
const parts = await Promise.all(Array.from({ length: workers }, (_, w) => renderPart(w)));
await browser.close();
const list = path.join(tmp, 'parts.txt');
writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
const video = path.join(OUT, 'video-sin-audio.mp4');
await new Promise((r, j) =>
  spawn(ffmpeg, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', video], { stdio: 'inherit' })
    .on('close', (c) => (c === 0 ? r() : j(new Error(`concat ${c}`)))),
);
if (!existsSync(video)) throw new Error('No se generó el video.');
console.log(`✓ ${video} en ${((Date.now() - started) / 1000).toFixed(0)} s`);
