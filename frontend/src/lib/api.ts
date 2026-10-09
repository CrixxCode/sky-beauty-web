/** Forma de los errores que devuelve el backend (ver backend/src/shared/http/all-exceptions.filter.ts). */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    const message = body?.message;
    super(Array.isArray(message) ? message.join(' ') : (message ?? `Error ${status}`));
    this.name = 'ApiError';
  }
}

const API_PATH = '/api/v1';

/**
 * En el navegador se usa la ruta relativa /api/v1 (Next.js la reenvía al backend).
 * En el servidor (Server Components) se llama directamente a API_INTERNAL_URL.
 */
function apiBaseUrl(): string {
  if (typeof window !== 'undefined') return API_PATH;
  const internal = process.env.API_INTERNAL_URL;
  if (!internal) throw new Error('API_INTERNAL_URL no está definida.');
  return `${internal.replace(/\/$/, '')}${API_PATH}`;
}

/** Llama a la API del backend y devuelve el JSON de la respuesta, o lanza ApiError. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
