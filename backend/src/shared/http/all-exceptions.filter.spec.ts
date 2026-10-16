import { type ArgumentsHost, PayloadTooLargeException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '../../generated/prisma/client';
import { AllExceptionsFilter, type ErrorResponseBody } from './all-exceptions.filter';

/** Ejecuta el filtro con una petición falsa y devuelve el código y el cuerpo de la respuesta. */
function respond(exception: unknown): { status: number; body: ErrorResponseBody } {
  const result = { status: 0, body: undefined as unknown as ErrorResponseBody };
  const response = {
    status: (code: number) => {
      result.status = code;
      return response;
    },
    json: (body: ErrorResponseBody) => {
      result.body = body;
    },
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ url: '/api/v1/prueba' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  const filter = new AllExceptionsFilter();
  // El error 500 se registra en el log; aquí no interesa la salida.
  jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  filter.catch(exception, host);
  return result;
}

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Detalle interno ${code}`, {
    code,
    clientVersion: 'test',
  });

describe('AllExceptionsFilter', () => {
  it.each([
    ['P2002', 409],
    ['P2003', 409],
    ['P2025', 404],
  ])('traduce el error %s de Prisma a %i con un mensaje en español', (code, status) => {
    const { status: got, body } = respond(prismaError(code));
    expect(got).toBe(status);
    expect(body.message).toBe(
      'La operación entra en conflicto con datos existentes o no encontrados.',
    );
    expect(JSON.stringify(body)).not.toContain('Detalle interno');
  });

  it('responde 429 en español cuando el limitador corta las peticiones', () => {
    const { status, body } = respond(new ThrottlerException());
    expect(status).toBe(429);
    expect(body.message).toBe(
      'Hiciste demasiadas solicitudes seguidas. Espera unos minutos e intenta de nuevo.',
    );
  });

  it('responde 413 en español a un archivo demasiado grande', () => {
    const { status, body } = respond(new PayloadTooLargeException());
    expect(status).toBe(413);
    expect(body.message).toBe('El archivo supera el tamaño máximo permitido.');
  });

  it('un error no controlado responde 500 genérico, sin la pila ni el texto original', () => {
    const { status, body } = respond(new Error('secreto interno en la consulta'));
    expect(status).toBe(500);
    expect(body).toMatchObject({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno del servidor.',
      path: '/api/v1/prueba',
    });
    expect(JSON.stringify(body)).not.toMatch(/secreto interno|at .*\.ts/);
  });
});
