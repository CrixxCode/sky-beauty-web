import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/** Cabecera con la que el servidor de Next.js se identifica ante la API (INTERNAL_API_KEY). */
export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/**
 * Indica si la petición viene del servidor de Next.js (lleva la clave interna correcta). El
 * navegador nunca la conoce: las peticiones que pasan por el proxy de Next.js no la llevan.
 */
export function isInternalRequest(request: Request, internalKey: string | undefined): boolean {
  if (!internalKey) return false;
  const sent = request.headers[INTERNAL_API_KEY_HEADER];
  if (typeof sent !== 'string') return false;
  const expected = Buffer.from(internalKey);
  const received = Buffer.from(sent);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
