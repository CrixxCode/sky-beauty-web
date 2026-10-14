// Validación del MP4 final: formato con ffprobe, cuadros negros o vacíos con ffmpeg y una hoja
// de cuadros de control cada 10 s para revisión visual.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { ROOT } from './lib/env.mjs';

const file = process.argv[2] ?? path.join(ROOT, 'output', 'sky-beauty-demo.mp4');
const probe = JSON.parse(execFileSync(ffprobeStatic.path, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { encoding: 'utf8' }));
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
const dur = Number(probe.format.duration);
const [num, den] = v.r_frame_rate.split('/').map(Number);
const checks = [
  ['Contenedor MP4', /mp4/.test(probe.format.format_name)],
  ['Códec de video H.264', v.codec_name === 'h264'],
  ['Resolución 1920×1080', v.width === 1920 && v.height === 1080],
  ['Relación 16:9', Math.abs(v.width / v.height - 16 / 9) < 1e-3],
  ['30 fps', Math.abs(num / den - 30) < 0.01],
  ['Píxeles yuv420p (compatibles con todos los reproductores)', v.pix_fmt === 'yuv420p'],
  ['Audio AAC', a?.codec_name === 'aac'],
  ['Duración entre 2 y 3 minutos', dur >= 120 && dur <= 180],
];

// Cuadros negros (más de 0,3 s) y congelados largos (más de 4 s sin ningún cambio).
const det = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-vf', 'blackdetect=d=0.3:pix_th=0.08,freezedetect=n=0.0005:d=4', '-an', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const blacks = [...det.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => `${m[1]}–${m[2]} s`);
const freezes = [...det.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => `${Number(m[1]).toFixed(1)} s`);
checks.push(['Sin cuadros negros', blacks.length === 0]);

// Cuadros de control cada 10 s
const out = path.join(ROOT, 'screenshots', 'control');
mkdirSync(out, { recursive: true });
execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', file, '-vf', 'fps=1/10,scale=480:-2,tile=4x5:padding=6:color=white', '-frames:v', '1', path.join(out, 'control-sheet.jpg')]);

console.log(`${path.basename(file)} · ${(Number(probe.format.size) / 1e6).toFixed(1)} MB · ${Math.floor(dur / 60)}:${(dur % 60).toFixed(1).padStart(4, '0')}`);
console.log(`Video: ${v.codec_name} ${v.profile} ${v.width}×${v.height} ${(num / den).toFixed(2)} fps ${v.pix_fmt} · ${(Number(v.bit_rate) / 1e6).toFixed(1)} Mb/s`);
console.log(`Audio: ${a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels} canales · ${(Number(a.bit_rate) / 1e3).toFixed(0)} kb/s` : 'sin audio'}`);
for (const [name, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${name}`);
if (blacks.length) console.log(`  Cuadros negros: ${blacks.join(', ')}`);
console.log(`Tramos sin cambios de más de 4 s: ${freezes.length ? freezes.join(', ') : 'ninguno'}`);
console.log(`Hoja de control: ${path.join(out, 'control-sheet.jpg')}`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
