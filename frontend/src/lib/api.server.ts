/**
 * Llama a la API del backend desde el servidor de Next.js (Server Components), sin sesión.
 * Devuelve null si la API no responde o responde con error, para que la página se pueda mostrar igual.
 */
export async function fetchPublicApi<T>(path: string): Promise<T | null> {
  const apiUrl = process.env.API_INTERNAL_URL;
  if (!apiUrl) throw new Error('API_INTERNAL_URL no está definida.');
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/api/v1${path}`, {
      cache: 'no-store',
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}
