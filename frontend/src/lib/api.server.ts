import { unstable_rethrow } from 'next/navigation';

/**
 * Cabeceras de las llamadas del servidor de Next.js a la API. La clave interna (INTERNAL_API_KEY,
 * la misma del backend) hace que estas llamadas no cuenten para el límite de peticiones por IP:
 * todas salen de la IP de este servidor, para todos los visitantes. Solo se usa en el servidor.
 */
export function internalApiHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const key = process.env.INTERNAL_API_KEY;
  if (key) headers.set('x-internal-api-key', key);
  return headers;
}

/** La API no respondió o respondió con un error que no es "no existe". */
export class ApiUnavailableError extends Error {
  constructor(path: string, status?: number) {
    super(`La API no respondió ${path}${status ? ` (HTTP ${status})` : ''}.`);
    this.name = 'ApiUnavailableError';
  }
}

/**
 * Llama a la API del backend desde el servidor de Next.js (Server Components), sin sesión.
 * Devuelve null si el recurso no existe (404). Si la API falla, lanza ApiUnavailableError: la
 * página muestra "intenta de nuevo" en lugar de decir que el producto o la página no existen.
 */
export async function fetchPublicApi<T>(path: string): Promise<T | null> {
  const apiUrl = process.env.API_INTERNAL_URL;
  if (!apiUrl) throw new Error('API_INTERNAL_URL no está definida.');
  let response: Response;
  try {
    response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1${path}`, {
      headers: internalApiHeaders(),
      cache: 'no-store',
    });
  } catch (err) {
    // Deja pasar las señales internas de Next.js (p. ej. la que marca la página como dinámica).
    unstable_rethrow(err);
    throw new ApiUnavailableError(path);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiUnavailableError(path, response.status);
  return (await response.json()) as T;
}

/**
 * Como fetchPublicApi, pero nunca lanza: para datos de apoyo (metadatos, encabezado y pie de la
 * tienda) que no deben impedir mostrar la página. Si la API falla, devuelve null.
 */
export async function fetchPublicApiOptional<T>(path: string): Promise<T | null> {
  try {
    return await fetchPublicApi<T>(path);
  } catch (err) {
    unstable_rethrow(err);
    return null;
  }
}
