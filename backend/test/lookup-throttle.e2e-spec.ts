import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

// El límite de peticiones se desactiva en las pruebas (NODE_ENV=test). Esta prueba lo activa para
// comprobar el límite estricto del rastreador por código y teléfono. La app se carga después de
// cambiar la variable, porque la configuración se lee al importar los módulos.

describe('Rastreador: límite de intentos (integración)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'development';
    const { createTestApp } = await import('./utils/app.js');
    ({ app } = await createTestApp());
  });

  afterAll(() => app.close());

  it('bloquea el sexto intento en un minuto desde la misma conexión', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/v1/store/orders/lookup')
        .send({ code: 'SB-000000-000000', phone: '3001112233' });

    for (let i = 0; i < 5; i += 1) {
      await attempt().expect(404);
    }
    await attempt().expect(429);
  });
});
