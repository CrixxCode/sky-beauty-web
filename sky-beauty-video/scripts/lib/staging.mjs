// Preparación reversible de la tienda de desarrollo para la grabación.
//
// Los productos que no son de demostración (creados a mano durante el desarrollo, como "Prueba")
// se pausan (INACTIVE) mientras se graba y se reactivan al terminar. Reactivar conserva su fecha de
// publicación, así que la tienda queda como estaba. Los slugs se configuran con HIDE_SLUGS.
import { API, adminCredentials } from './env.mjs';

export const HIDE_SLUGS = (process.env.HIDE_SLUGS ?? 'prueba').split(',').filter(Boolean);

async function session() {
  const { email, password } = adminCredentials();
  const res = await fetch(`${API}/admin/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Inicio de sesión del panel: HTTP ${res.status}`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return async (method, path, body) => {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`${method} ${path}: HTTP ${r.status} ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  };
}

export const VIDEO_CUSTOMER = 'Clienta Demo Video';

/**
 * Cancela (con motivo y liberando existencias) los pedidos de prueba de grabaciones anteriores que
 * sigan abiertos, para que cada grabación deje un solo pedido de prueba en la base de desarrollo.
 */
export async function cancelPreviousVideoOrders() {
  const api = await session();
  const list = await api('GET', `/admin/orders?limit=50&q=${encodeURIComponent(VIDEO_CUSTOMER)}`);
  const open = list.items.filter(
    (o) => o.customerName === VIDEO_CUSTOMER && !['CANCELLED', 'DELIVERED', 'RETURNED'].includes(o.status),
  );
  for (const o of open) {
    await api('PATCH', `/admin/orders/${o.id}/cancel`, {
      reason: 'Pedido de prueba de la grabación del video de demostración.',
    });
    console.log(`  · Cancelado el pedido de prueba anterior ${o.code}`);
  }
}

/** Pausa los productos indicados y devuelve una función que restaura su estado anterior. */
export async function hideProducts(slugs = HIDE_SLUGS) {
  if (!slugs.length) return async () => {};
  const api = await session();
  const list = await api('GET', '/admin/products?limit=100');
  const targets = list.items.filter((p) => slugs.includes(p.slug) && p.status === 'ACTIVE');
  for (const p of targets) {
    await api('PATCH', `/admin/products/${p.id}/status`, { status: 'INACTIVE' });
    console.log(`  · Pausado durante la grabación: ${p.name}`);
  }
  return async () => {
    const again = await session();
    for (const p of targets) {
      await again('PATCH', `/admin/products/${p.id}/status`, { status: 'ACTIVE' });
      console.log(`  · Reactivado: ${p.name}`);
    }
  };
}
