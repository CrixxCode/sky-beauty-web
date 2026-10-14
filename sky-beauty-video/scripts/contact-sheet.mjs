// Hoja de contactos para revisar una grabación: cuadros en las marcas (o cada N s) en una cuadrícula.
// Uso: node scripts/contact-sheet.mjs <clip> [cada-segundos] [desde] [hasta]
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { ROOT } from './lib/env.mjs';

const [clip, every, from = '0', to = '9999'] = process.argv.slice(2);
const dir = path.join(ROOT, 'recordings', clip);
const meta = JSON.parse(readFileSync(path.join(dir, 'meta.json'), 'utf8'));
const pick = (t) => meta.frames.filter((f) => f.t <= t).pop() ?? meta.frames[0];
let times;
if (every) {
  times = [];
  for (let t = Number(from); t <= Math.min(Number(to), meta.duration); t += Number(every)) times.push(t);
} else {
  times = Object.entries(meta.marks).map(([, t]) => t + 0.9);
}
const out = path.join(ROOT, 'screenshots', 'review');
mkdirSync(out, { recursive: true });
const cols = 4;
for (let page = 0; page * 16 < times.length; page++) {
  const chunk = times.slice(page * 16, page * 16 + 16);
  if (chunk.length === 1) chunk.push(chunk[0]);
  const inputs = chunk.flatMap((t) => ['-i', path.join(dir, pick(t).file)]);
  const rows = Math.ceil(chunk.length / cols);
  const scale = chunk.map((_, i) => `[${i}:v]scale=480:-2,pad=488:ih+8:4:4:white[v${i}]`).join(';');
  const pads = chunk.map((_, i) => `[v${i}]`).join('');
  const file = path.join(out, `${clip}-${page + 1}.jpg`);
  execFileSync(ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex',
    `${scale};${pads}xstack=inputs=${chunk.length}:layout=${chunk.map((_, i) => `${(i % cols) * 488}_${Math.floor(i / cols)}*h0`.replace('*h0', '')).map((s, i) => { const [x] = s.split('_'); return `${x}_${Math.floor(i / cols) === 0 ? 0 : Array(Math.floor(i / cols)).fill('h0').join('+')}`; }).join('|')}:fill=white`,
    '-frames:v', '1', '-q:v', '3', file]);
  console.log(file, chunk.map((t) => t.toFixed(1)).join(' '), rows);
}
