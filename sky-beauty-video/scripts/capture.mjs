// Graba los recorridos reales. Uso: node scripts/capture.mjs [store] [login] [admin] [mobile]
// Sin argumentos graba todo. "store" debe ir antes que "admin": el panel confirma el pedido de
// prueba que crea la tienda.
//
// Solo la tienda pública oculta los productos ajenos a la demostración (y los reactiva al terminar);
// el panel se graba después, con el catálogo en su estado real.
import { cancelPreviousVideoOrders, hideProducts } from './lib/staging.mjs';

const wanted = process.argv.slice(2);
const run = wanted.length ? wanted : ['store', 'mobile', 'login', 'admin'];
const storeClips = run.filter((n) => n === 'store' || n === 'mobile');
const panelClips = run.filter((n) => n === 'login' || n === 'admin');

if (storeClips.length) {
  const restore = await hideProducts();
  try {
    for (const name of storeClips) {
      console.log(`Grabando: ${name}`);
      if (name === 'store') {
        await cancelPreviousVideoOrders();
        await (await import('./capture-store.mjs')).captureStore();
      }
      if (name === 'mobile') await (await import('./capture-mobile.mjs')).captureMobile();
    }
  } finally {
    await restore();
  }
}
for (const name of panelClips) {
  console.log(`Grabando: ${name}`);
  const admin = await import('./capture-admin.mjs');
  if (name === 'login') await admin.captureLogin();
  if (name === 'admin') await admin.captureAdmin();
}
