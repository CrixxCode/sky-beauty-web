import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';

// No modifica datos. Solo se debe apuntar al entorno autorizado de pruebas.
const base = process.env.PERF_BASE_URL;
if (!base) throw new Error('Define PERF_BASE_URL del backend de pruebas.');
const connections = Number(process.env.PERF_CONNECTIONS ?? 20);
const seconds = Number(process.env.PERF_SECONDS ?? 60);
if (
  !Number.isInteger(connections) ||
  connections < 1 ||
  connections > 100 ||
  !Number.isFinite(seconds) ||
  seconds < 1 ||
  seconds > 300
) {
  throw new Error('Usa entre 1 y 100 conexiones y entre 1 y 300 segundos.');
}
const paths = (
  process.env.PERF_PATHS ?? '/api/v1/store/products?q=QA,/api/v1/store/products?onSale=true'
).split(',');
const transport = new URL(base).protocol === 'https:' ? https : http;
const agent = new transport.Agent({ keepAlive: true, maxSockets: connections });
const headers = process.env.INTERNAL_API_KEY
  ? { 'x-internal-api-key': process.env.INTERNAL_API_KEY }
  : {};
const latencies = [];
const statusCounts = {};
const errorCounts = {};
let failures = 0;
function request(route) {
  return new Promise((resolve) => {
    const start = performance.now();
    let completed = false;
    const failed = (error) => {
      if (completed) return;
      completed = true;
      failures++;
      const code = error?.code ?? 'CONNECTION_ERROR';
      errorCounts[code] = (errorCounts[code] ?? 0) + 1;
      resolve();
    };
    const req = transport.get(new URL(route, base), { agent, headers, timeout: 30000 }, (res) => {
      res.resume();
      res.once('end', () => {
        if (completed) return;
        completed = true;
        statusCounts[res.statusCode] = (statusCounts[res.statusCode] ?? 0) + 1;
        if (res.statusCode !== 200) failures++;
        latencies.push(performance.now() - start);
        resolve();
      });
      res.once('error', failed);
    });
    req.once('timeout', () => req.destroy());
    req.once('error', failed);
  });
}
await Promise.all(paths.map(request)); // Calentamiento, fuera de las cifras.
if (failures)
  throw new Error('La API de pruebas no está lista o no responde 200; no se inició la carga.');
latencies.length = 0;
failures = 0;
for (const code of Object.keys(statusCounts)) delete statusCounts[code];
const started = performance.now();
const until = started + seconds * 1000;
await Promise.all(
  Array.from({ length: connections }, async (_, worker) => {
    let iteration = worker;
    while (performance.now() < until) await request(paths[iteration++ % paths.length]);
  }),
);
const duration = (performance.now() - started) / 1000;
agent.destroy();
latencies.sort((a, b) => a - b);
const percentile = (p) =>
  Math.round(latencies[Math.max(0, Math.ceil(latencies.length * p) - 1)] ?? 0);
console.log(
  JSON.stringify(
    {
      connections,
      seconds: Math.round(duration * 10) / 10,
      paths,
      requests: latencies.length,
      requestsPerSecond: Math.round((latencies.length / duration) * 10) / 10,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      failures,
      statusCounts,
      errorCounts,
    },
    null,
    2,
  ),
);
if (failures) process.exitCode = 1;
