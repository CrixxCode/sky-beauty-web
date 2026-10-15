import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('Salud (integración)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health responde ok con la base de datos disponible', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'ok' });
  });

  it('una ruta inexistente responde con el formato uniforme de error', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/no-existe').expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      error: 'NOT_FOUND',
      path: '/api/v1/no-existe',
    });
    expect(typeof (res.body as { timestamp: unknown }).timestamp).toBe('string');
  });

  it('un JSON mal formado o demasiado grande responde 4xx, no 500', async () => {
    const malformed = await request(app.getHttpServer())
      .post('/api/v1/store/orders/quote')
      .set('Content-Type', 'application/json')
      .send('{"items": [')
      .expect(400);
    expect((malformed.body as { message: string }).message).toBe(
      'El contenido enviado no es un JSON válido.',
    );
    const big = await request(app.getHttpServer())
      .post('/api/v1/store/orders/quote')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ items: [], relleno: 'x'.repeat(3_000_000) }))
      .expect(413);
    expect((big.body as { message: string }).message).toBe(
      'El contenido enviado supera el tamaño máximo permitido.',
    );
  });

  it('aplica cabeceras de seguridad', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
