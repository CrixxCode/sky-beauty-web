import { ADMIN_SESSION_EXPIRED_EVENT, ApiError, apiFetch } from './api';

function mockFetchResponse(status: number, body: unknown) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      body === undefined ? Promise.reject(new Error('sin cuerpo')) : Promise.resolve(body),
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('apiFetch', () => {
  it('llama a la ruta relativa /api/v1 desde el navegador y devuelve el JSON', async () => {
    const fetchMock = mockFetchResponse(200, { status: 'ok' });

    await expect(apiFetch('/health')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('envía JSON con la cabecera Content-Type', async () => {
    const fetchMock = mockFetchResponse(201, { id: '1' });

    await apiFetch('/recurso', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1].headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('lanza ApiError con el mensaje del backend', async () => {
    mockFetchResponse(409, {
      statusCode: 409,
      error: 'CONFLICT',
      message: ['El SKU ya existe.', 'Revise los datos.'],
      path: '/api/v1/recurso',
      timestamp: '2026-10-09T00:00:00.000Z',
    });

    const error = await apiFetch('/recurso').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'El SKU ya existe. Revise los datos.' });
  });

  it('lanza ApiError aunque la respuesta de error no tenga cuerpo JSON', async () => {
    mockFetchResponse(502, undefined);

    await expect(apiFetch('/health')).rejects.toMatchObject({ status: 502, message: 'Error 502' });
  });

  it('una respuesta exitosa sin cuerpo no es un error (204 o 200 vacío)', async () => {
    mockFetchResponse(200, undefined);
    await expect(apiFetch('/admin/settings/shipping-rates/1', { method: 'DELETE' })).resolves.toBe(
      undefined,
    );
  });

  it('avisa que la sesión del panel terminó con un 401, salvo en el inicio de sesión', async () => {
    const onExpired = jest.fn();
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
    mockFetchResponse(401, undefined);

    await expect(apiFetch('/admin/orders')).rejects.toMatchObject({ status: 401 });
    await expect(apiFetch('/admin/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
    });
    await expect(apiFetch('/store/products')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, onExpired);
  });
});
