// Audio del video: música instrumental original sintetizada aquí mismo (sin pistas de terceros)
// y efectos de sonido sintetizados, sincronizados con la línea de tiempo. Luego se une al video.
//
// Uso:
//   node scripts/audio.mjs                         → output/sky-beauty-demo.mp4 (video + audio)
//   node scripts/audio.mjs --music pista.mp3       → usa una pista licenciada en lugar de la sintetizada
//   node scripts/audio.mjs --no-music              → solo efectos de sonido
//
// Música: 88 BPM, Fa mayor, progresión Fmaj9 – Dm9 – Bbmaj9 – Csus (dos compases cada acorde).
// Piano eléctrico (síntesis FM) en arpegio, pad, bajo y percusión suave; reverberación tipo Freeverb.
import { writeFileSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { ROOT } from './lib/env.mjs';
import { buildTimeline } from './timeline.mjs';

const args = process.argv.slice(2);
const musicFile = args.includes('--music') ? args[args.indexOf('--music') + 1] : null;
const noMusic = args.includes('--no-music');

const SR = 48000;
const tl = buildTimeline();
const DUR = tl.duration;
const N = Math.ceil(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const TAU = Math.PI * 2;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Generador pseudoaleatorio con semilla: el audio es idéntico en cada render.
let seed = 20261014;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function add(buf, i, v) { if (i >= 0 && i < N) buf[i] += v; }

// ─────────────────────────────── Música ───────────────────────────────
const BPM = 88;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const CHORDS = [
  { bass: 41, pad: [57, 60, 64, 67] }, // Fmaj9
  { bass: 38, pad: [53, 57, 60, 64] }, // Dm9
  { bass: 34, pad: [57, 60, 62, 65] }, // Bbmaj9
  { bass: 36, pad: [55, 60, 62, 65] }, // Csus(add9)
];
const CHORD_LEN = BAR * 2;

// Intensidad de cada capa según la sección del video (0..1), suavizada.
const sec = { introOut: tl.introOut, admin: tl.shots.find((s) => s.clip === 'login')?.t0 ?? DUR, R0: tl.responsive.R0, O: tl.outro };
const ramp = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const layer = {
  pad: (t) => 0.8 + 0.2 * ramp(t, 0, 4),
  keys: (t) => ramp(t, sec.introOut - 1.5, sec.introOut + 0.5) * (1 - 0.6 * ramp(t, sec.O + 0.5, sec.O + 2.5)),
  bass: (t) => ramp(t, sec.introOut, sec.introOut + 2) * (1 - ramp(t, sec.O, sec.O + 1.5)),
  drums: (t) => ramp(t, sec.introOut + 2 * BAR, sec.introOut + 2 * BAR + 0.1) * (1 - ramp(t, sec.O - 0.2, sec.O + 0.3)),
  hats: (t) => ramp(t, sec.admin, sec.admin + BAR) * (1 - ramp(t, sec.O - 0.2, sec.O + 0.3)),
};
const master = (t) => Math.min(1, t / 1.2) * (1 - ramp(t, DUR - 4.2, DUR - 0.05)) ** 1.6;

// Buses con reverberación (pad y piano) y en seco (bajo, percusión).
const wetL = new Float32Array(N);
const wetR = new Float32Array(N);

function padNote(m, t0, len, gain, pan) {
  const f = mtof(m);
  const atk = 1.6, rel = 2.2;
  const i0 = Math.floor(t0 * SR), i1 = Math.min(N, Math.floor((t0 + len + rel) * SR));
  const det = [0.997, 1.0, 1.0035];
  const ph = det.map(() => rand() * TAU);
  for (let i = Math.max(0, i0); i < i1; i++) {
    const t = i / SR - t0;
    const env = Math.min(1, t / atk) * (t > len ? Math.exp(-(t - len) * 2.2) : 1);
    if (env < 1e-4 && t > len) break;
    const tt = i / SR;
    const vib = 1 + 0.0018 * Math.sin(TAU * 4.6 * tt + m);
    let v = 0;
    for (let k = 0; k < 3; k++) {
      const p = TAU * f * det[k] * vib * t + ph[k];
      v += Math.sin(p) + 0.18 * Math.sin(2 * p) + 0.06 * Math.sin(3 * p);
    }
    v *= (env * gain * layer.pad(tt)) / 3;
    add(wetL, i, v * (1 - pan) * 0.9);
    add(wetR, i, v * pan * 0.9);
    add(L, i, v * (1 - pan) * 0.35);
    add(R, i, v * pan * 0.35);
  }
}

function epNote(m, t0, vel, pan) {
  const f = mtof(m);
  const i0 = Math.floor(t0 * SR), i1 = Math.min(N, i0 + Math.floor(2.4 * SR));
  for (let i = Math.max(0, i0); i < i1; i++) {
    const t = i / SR - t0;
    const tt = i / SR;
    const g = layer.keys(tt);
    if (g <= 0) continue;
    const env = Math.exp(-t * 2.4) * (1 - Math.exp(-t * 600));
    const idx = 1.5 * Math.exp(-t * 4) + 0.25;
    const mod = Math.sin(TAU * f * t);
    const tine = 0.12 * Math.sin(TAU * f * 7.02 * t) * Math.exp(-t * 18);
    const v = (Math.sin(TAU * f * t + idx * mod) + tine) * env * vel * g;
    add(L, i, v * (1 - pan) * 0.55);
    add(R, i, v * pan * 0.55);
    add(wetL, i, v * (1 - pan) * 0.5);
    add(wetR, i, v * pan * 0.5);
  }
}

function bassNote(m, t0, len, vel) {
  const f = mtof(m);
  const i0 = Math.floor(t0 * SR), i1 = Math.min(N, Math.floor((t0 + len + 0.3) * SR));
  for (let i = Math.max(0, i0); i < i1; i++) {
    const t = i / SR - t0;
    const tt = i / SR;
    const env = (1 - Math.exp(-t * 80)) * (t > len ? Math.exp(-(t - len) * 12) : Math.exp(-t * 0.6));
    const v = (Math.sin(TAU * f * t) + 0.25 * Math.sin(TAU * 2 * f * t)) * env * vel * layer.bass(tt);
    add(L, i, v); add(R, i, v);
  }
}

function kick(t0, vel) {
  const i0 = Math.floor(t0 * SR);
  for (let k = 0; k < 0.35 * SR; k++) {
    const t = k / SR, i = i0 + k;
    const g = layer.drums(i / SR);
    if (g <= 0) continue;
    const f = 48 + 70 * Math.exp(-t * 30);
    const v = Math.sin(TAU * f * t) * Math.exp(-t * 9) * vel * g;
    add(L, i, v); add(R, i, v);
  }
}

function hat(t0, vel, pan, open = false) {
  const i0 = Math.floor(t0 * SR);
  let hp = 0, prev = 0;
  const len = open ? 0.18 : 0.06;
  for (let k = 0; k < len * SR; k++) {
    const t = k / SR, i = i0 + k;
    const g = Math.max(layer.hats(i / SR), layer.drums(i / SR) * 0.45);
    if (g <= 0) continue;
    const n = rand() * 2 - 1;
    hp = 0.92 * (hp + n - prev); prev = n; // paso alto simple
    const v = hp * Math.exp(-t * (open ? 22 : 60)) * vel * g;
    add(L, i, v * (1 - pan)); add(R, i, v * pan);
  }
}

function shaker(t0, vel) {
  const i0 = Math.floor(t0 * SR);
  let bp = 0, prev = 0;
  for (let k = 0; k < 0.09 * SR; k++) {
    const t = k / SR, i = i0 + k;
    const g = layer.drums(i / SR);
    if (g <= 0) continue;
    const n = rand() * 2 - 1;
    bp = 0.8 * (bp + n - prev); prev = n;
    const env = Math.sin(Math.PI * Math.min(1, t / 0.09));
    const v = bp * env * vel * g;
    add(L, i, v * 0.4); add(R, i, v * 0.6);
  }
}

function writeMusic() {
  // Pad y bajo por acorde
  for (let c = 0, t = 0; t < DUR + 1; c++, t += CHORD_LEN) {
    const ch = CHORDS[c % 4];
    // En el cierre el último acorde es Fmaj9 sostenido hasta el final.
    if (t >= sec.O && t < DUR) {
      const last = CHORDS[0];
      last.pad.forEach((m, k) => padNote(m, t, DUR - t, 0.1, 0.3 + 0.13 * k));
      padNote(last.pad[3] + 12, t + 0.4, DUR - t, 0.05, 0.65);
      break;
    }
    ch.pad.forEach((m, k) => padNote(m, t, CHORD_LEN - 0.1, 0.07, 0.3 + 0.13 * k));
    // Bajo: tiempo 1 y "y" del 3 en cada compás
    for (let b = 0; b < 2; b++) {
      const bt = t + b * BAR;
      bassNote(ch.bass, bt, BEAT * 2.2, 0.075);
      bassNote(ch.bass + (b ? 7 : 0), bt + BEAT * 2.5, BEAT * 1.2, 0.05);
    }
    // Arpegio del piano eléctrico en corcheas, una octava arriba del pad
    const notes = [...ch.pad.map((m) => m + 12), ch.pad[1] + 24];
    const pattern = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 1, 3, 4, 3, 2, 1];
    pattern.forEach((p, k) => {
      const nt = t + k * (BEAT / 2); // 16 corcheas = los dos compases del acorde
      const accent = k % 4 === 0 ? 1 : k % 2 === 0 ? 0.75 : 0.55;
      epNote(notes[p], nt + (rand() - 0.5) * 0.012, 0.13 * accent, 0.35 + 0.3 * (p / 4));
    });
  }
  // Percusión
  for (let t = 0; t < DUR; t += BEAT) {
    const beat = Math.round(t / BEAT) % 4;
    if (beat === 0 || beat === 2) kick(t, beat === 0 ? 0.2 : 0.14);
    hat(t + BEAT / 2, 0.05, 0.62, beat === 3);
    shaker(t + BEAT * 0.25, 0.035);
    shaker(t + BEAT * 0.75, 0.028);
  }
}

// Reverberación tipo Freeverb sobre el bus húmedo.
function reverb(inL, inR, room = 0.86, damp = 0.35) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((x) => Math.round((x * SR) / 44100));
  const aps = [556, 441, 341, 225].map((x) => Math.round((x * SR) / 44100));
  const run = (input, spread) => {
    const out = new Float32Array(N);
    const cb = combs.map((d) => ({ buf: new Float32Array(d + spread), i: 0, store: 0 }));
    const ab = aps.map((d) => ({ buf: new Float32Array(d + spread), i: 0 }));
    for (let n = 0; n < N; n++) {
      const x = input[n] * 0.015;
      let s = 0;
      for (const c of cb) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * room;
        c.i = (c.i + 1) % c.buf.length;
        s += y;
      }
      for (const a of ab) {
        const b = a.buf[a.i];
        const y = -s + b;
        a.buf[a.i] = s + b * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        s = y;
      }
      out[n] = s;
    }
    return out;
  };
  return [run(inL, 0), run(inR, 23)];
}

// ─────────────────────────────── Efectos ───────────────────────────────
const fx = {
  click(t0, vel = 1) {
    const i0 = Math.floor(t0 * SR);
    for (let k = 0; k < 0.05 * SR; k++) {
      const t = k / SR;
      const v = (Math.sin(TAU * 2300 * t) * 0.5 + Math.sin(TAU * 1250 * t)) * Math.exp(-t * 140) * 0.09 * vel
        + (rand() * 2 - 1) * Math.exp(-t * 700) * 0.03 * vel;
      add(L, i0 + k, v); add(R, i0 + k, v);
    }
  },
  tap(t0) {
    const i0 = Math.floor(t0 * SR);
    for (let k = 0; k < 0.07 * SR; k++) {
      const t = k / SR;
      const v = Math.sin(TAU * (520 + 300 * Math.exp(-t * 60)) * t) * Math.exp(-t * 70) * 0.11;
      add(L, i0 + k, v); add(R, i0 + k, v);
    }
  },
  whoosh(t0, len = 0.9, vel = 1) {
    const i0 = Math.floor((t0 - len * 0.55) * SR);
    let lp = 0, lp2 = 0;
    for (let k = 0; k < len * SR; k++) {
      const t = k / SR, u = t / len;
      const env = Math.sin(Math.PI * u) ** 2;
      const cut = 0.02 + 0.16 * Math.sin(Math.PI * u);
      const n = rand() * 2 - 1;
      lp += cut * (n - lp); lp2 += cut * (lp - lp2);
      const v = lp2 * env * 0.5 * vel;
      add(L, i0 + k, v * (1 - u * 0.6)); add(R, i0 + k, v * (0.4 + u * 0.6));
    }
  },
  bell(t0, m, vel, len = 2.2, pan = 0.5) {
    const f = mtof(m);
    const i0 = Math.floor(t0 * SR);
    for (let k = 0; k < len * SR; k++) {
      const t = k / SR;
      const env = Math.exp(-t * 2.6) * (1 - Math.exp(-t * 900));
      const v = (Math.sin(TAU * f * t + 0.8 * Math.exp(-t * 6) * Math.sin(TAU * f * 3.5 * t)) + 0.3 * Math.sin(TAU * f * 2.01 * t) * Math.exp(-t * 5)) * env * vel;
      add(L, i0 + k, v * (1 - pan)); add(R, i0 + k, v * pan);
      add(wetL, i0 + k, v * 1.2); add(wetR, i0 + k, v * 1.2);
    }
  },
  success(t0) { this.bell(t0, 88, 0.05, 1.6, 0.45); this.bell(t0 + 0.11, 95, 0.045, 1.8, 0.55); },
  logo(t0) { [84, 88, 91, 96].forEach((m, k) => this.bell(t0 + k * 0.16, m, 0.07, 2.6, 0.3 + k * 0.13)); this.whoosh(t0 + 0.2, 1.6, 0.6); },
  credit(t0) { [84, 91].forEach((m, k) => this.bell(t0 + k * 0.14, m, 0.045, 2.8, 0.4 + k * 0.2)); },
  outro(t0) { [77, 81, 84, 88, 91].forEach((m, k) => this.bell(t0 + k * 0.09, m, 0.07, 3.5, 0.3 + k * 0.1)); },
};

function writeSfx() {
  let lastClick = -1;
  for (const c of tl.sfx) {
    if (c.kind === 'click' || c.kind === 'tap') {
      if (c.T - lastClick < 0.12) continue; // dos clics casi simultáneos suenan como uno
      lastClick = c.T;
      if (c.kind === 'tap') fx.tap(c.T); else fx.click(c.T, 0.9);
    } else if (c.kind === 'whoosh') fx.whoosh(c.T, 0.9, 0.55);
    else fx[c.kind](c.T);
  }
}

// ─────────────────────────────── Mezcla ───────────────────────────────
console.log(`Generando audio (${DUR.toFixed(1)} s)…`);
if (!noMusic && !musicFile) writeMusic();
writeSfx();
const [rvL, rvR] = reverb(wetL, wetR);
for (let n = 0; n < N; n++) {
  const g = master(n / SR);
  L[n] = Math.tanh((L[n] + rvL[n]) * g * 1.4) * 0.8;
  R[n] = Math.tanh((R[n] + rvR[n]) * g * 1.4) * 0.8;
}

function wav(file, a, b) {
  const buf = Buffer.alloc(44 + N * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
  for (let n = 0; n < N; n++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, a[n])) * 32767), 44 + n * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, b[n])) * 32767), 46 + n * 4);
  }
  writeFileSync(file, buf);
}
const OUT = path.join(ROOT, 'output');
const mixWav = path.join(ROOT, 'recordings', 'audio-mix.wav');
wav(mixWav, L, R);

const video = path.join(OUT, 'video-sin-audio.mp4');
if (!existsSync(video)) throw new Error('Falta output/video-sin-audio.mp4: ejecuta antes node scripts/render.mjs');
const final = path.join(OUT, 'sky-beauty-demo.mp4');
const inputs = ['-i', video, '-i', mixWav];
let filter = '[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]';
if (musicFile) {
  // Pista externa licenciada: se recorta, se le hace fundido de entrada y salida y se mezcla bajo los efectos.
  inputs.push('-stream_loop', '-1', '-i', musicFile);
  filter = `[2:a]atrim=0:${DUR.toFixed(3)},afade=in:st=0:d=1.5,afade=out:st=${(DUR - 4).toFixed(3)}:d=4,volume=0.45,lowpass=f=6000[m];` +
    `[1:a][m]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[a]`;
}
const r = spawnSync(ffmpeg, ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', final], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('Falló la mezcla final');
console.log(`✓ ${final} (${(statSync(final).size / 1e6).toFixed(1)} MB)`);
