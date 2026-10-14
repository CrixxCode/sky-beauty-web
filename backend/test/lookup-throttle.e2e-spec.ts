import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { INTERNAL_API_KEY_HEADER } from '../src/shared/security/internal-request';

// El límite de peticiones se desactiva en las pruebas (NODE_ENV=test). Esta prueba lo activa para
// comprobar los límites estrictos del rastreador y del checkout, y que el servidor de Next.js (con
// la clave interna) no los consume. La app se carga después de cambiar las variables, porque la
// configuración se lee al importar los módulos.

const INTERNAL_KEY = 'clave-interna-de-prueba-'.padEnd(40, 'x');

describe('Límites de intentos (integración)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    process.env.INTERNAL_API_KEY = INTERNAL_KEY;
    const { createTestApp } = await import('./utils/app.js');
    ({ app } = await createTestApp());
  });

  afterAll(() => app.close());

  const lookup = () =>
    request(app.getHttpServer())
      .post('/api/v1/store/orders/lookup')
      .send({ code: 'SB-000000-000000', phone: '3001112233' });

  it('el rastreador bloquea el sexto intento en un minuto desde la misma conexión', async () => {
    for (let i = 0; i < 5; i += 1) {
      await lookup().expect(404);
    }
    await lookup().expect(429);
  });

  it('las peticiones del servidor de Next.js no cuentan para el límite', async () => {
    // La misma conexión ya agotó el límite en la prueba anterior.
    await lookup().set(INTERNAL_API_KEY_HEADER, INTERNAL_KEY).expect(404);
    await lookup().set(INTERNAL_API_KEY_HEADER, 'otra-clave').expect(429);
  });

  it('el checkout acepta máximo 10 pedidos cada 10 minutos desde la misma conexión', async () => {
    // El límite se revisa antes de validar los datos: los intentos inválidos también cuentan.
    const create = () => request(app.getHttpServer()).post('/api/v1/store/orders').send({});
    for (let i = 0; i < 10; i += 1) {
      await create().expect(400);
    }
    await create().expect(429);
  });
});
