import { ApiUnavailableError, fetchPublicApi, fetchPublicApiOptional } from './api.server';

function mockFetch(result: { status: number; body?: unknown } | Error) {
  const fetchMock =
    result instanceof Error
      ? jest.fn().mockRejectedValue(result)
      : jest.fn().mockResolvedValue({
          ok: result.status >= 200 && result.status < 300,
          status: result.status,
          json: () => Promise.resolve(result.body),
        });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('fetchPublicApi', () => {
  beforeEach(() => {
    process.env.API_INTERNAL_URL = 'http://api.interna.test/';
    process.env.INTERNAL_API_KEY = 'clave-interna-de-prueba';
  });

  it('llama a la API interna con la clave del servidor y devuelve el JSON', async () => {
    const fetchMock = mockFetch({ status: 200, body: { storeName: 'Tienda' } });

    await expect(fetchPublicApi('/store/info')).resolves.toEqual({ storeName: 'Tienda' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.interna.test/api/v1/store/info');
    expect((init.headers as Headers).get('x-internal-api-key')).toBe('clave-interna-de-prueba');
  });

  it('devuelve null solo cuando el recurso no existe', async () => {
    mockFetch({ status: 404 });
    await expect(fetchPublicApi('/store/products/no-existe')).resolves.toBeNull();
  });

  it('lanza un error si la API falla, para no confundirlo con "no existe"', async () => {
    mockFetch({ status: 429 });
    await expect(fetchPublicApi('/store/products/labial')).rejects.toBeInstanceOf(
      ApiUnavailableError,
    );
    mockFetch(new TypeError('fetch failed'));
    await expect(fetchPublicApi('/store/info')).rejects.toBeInstanceOf(ApiUnavailableError);
  });

  it('la versión opcional nunca lanza', async () => {
    mockFetch({ status: 500 });
    await expect(fetchPublicApiOptional('/store/info')).resolves.toBeNull();
  });

  it('sin clave configurada no envía la cabecera', async () => {
    delete process.env.INTERNAL_API_KEY;
    const fetchMock = mockFetch({ status: 200, body: {} });

    await fetchPublicApi('/store/info');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).has('x-internal-api-key')).toBe(false);
  });
});
