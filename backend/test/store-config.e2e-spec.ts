import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const SETTINGS = '/api/v1/admin/settings';
const METHODS = '/api/v1/admin/payment-methods';

const messageOf = (res: request.Response) => (res.body as { message: unknown }).message;

describe('Configuración de la tienda (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
    await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
  });
  afterAll(() => app.close());

  const methodId = async (code: string) =>
    (await prisma.paymentMethod.findUniqueOrThrow({ where: { code } })).id;

  describe('datos de la tienda', () => {
    it('el personal consulta la configuración pero no la modifica', async () => {
      const staff = await loginAgent(app, 'personal@ejemplo.test');
      await staff.get(SETTINGS).expect(200);
      await staff.patch(SETTINGS).send({ contactPhone: '123' }).expect(403);
    });

    it('la propietaria guarda los datos normalizados y puede borrarlos', async () => {
      const owner = await loginAgent(app, 'duena@ejemplo.test');

      const saved = await owner
        .patch(SETTINGS)
        .send({
          whatsappNumber: '300 123 4567',
          contactEmail: ' Hola@SkyBeauty.TEST ',
          instagramUrl: 'https://instagram.com/skybeauty.test',
          freeShippingThreshold: 150000,
          defaultLowStockThreshold: 3,
          maxPercentageDiscount: 50,
          maxUnitsPerProduct: 6,
        })
        .expect(200);
      expect(saved.body).toMatchObject({
        whatsappNumber: '573001234567',
        contactEmail: 'hola@skybeauty.test',
        freeShippingThreshold: 150000,
        defaultLowStockThreshold: 3,
        maxPercentageDiscount: 50,
        maxUnitsPerProduct: 6,
      });

      const cleared = await owner
        .patch(SETTINGS)
        .send({ instagramUrl: '', freeShippingThreshold: null, maxUnitsPerProduct: null })
        .expect(200);
      expect(cleared.body).toMatchObject({
        instagramUrl: null,
        freeShippingThreshold: null,
        maxUnitsPerProduct: null,
        whatsappNumber: '573001234567',
      });
    });

    it('valida WhatsApp, direcciones web, correo y cifras', async () => {
      const owner = await loginAgent(app, 'duena@ejemplo.test');
      for (const body of [
        { whatsappNumber: '601 555 1234' },
        { instagramUrl: 'instagram.com/sin-protocolo' },
        { contactEmail: 'no-es-correo' },
        { maxPercentageDiscount: 0 },
        { maxPercentageDiscount: 101 },
        { defaultLowStockThreshold: 2.5 },
        { maxUnitsPerProduct: 0 },
        { maxUnitsPerProduct: 1.5 },
        { maxUnitsPerProduct: 1000 },
        { freeShippingThreshold: -1 },
        { campoDesconocido: 'x' },
      ]) {
        await owner.patch(SETTINGS).send(body).expect(400);
      }
    });

    it('expone solo los datos públicos sin sesión', async () => {
      const owner = await loginAgent(app, 'duena@ejemplo.test');
      await owner
        .patch(SETTINGS)
        .send({ whatsappNumber: '3001234567', freeShippingThreshold: 150000 })
        .expect(200);

      const res = await request(app.getHttpServer()).get('/api/v1/store/info').expect(200);
      expect(res.body).toMatchObject({
        storeName: 'Sky Beauty Maquillaje',
        whatsappNumber: '573001234567',
      });
      expect(res.body).not.toHaveProperty('freeShippingThreshold');
      expect(res.body).not.toHaveProperty('maxPercentageDiscount');
    });
  });

  describe('métodos de pago', () => {
    it('el personal los consulta pero no los modifica', async () => {
      const staff = await loginAgent(app, 'personal@ejemplo.test');
      const res = await staff.get(METHODS).expect(200);
      expect((res.body as unknown[]).length).toBe(4);
      await staff
        .patch(`${METHODS}/${await methodId('NEQUI')}`)
        .send({ isActive: true })
        .expect(403);
    });

    it('no activa transferencia, Nequi ni Daviplata sin instrucciones', async () => {
      const owner = await loginAgent(app, 'duena@ejemplo.test');
      const nequi = await methodId('NEQUI');

      const rejected = await owner
        .patch(`${METHODS}/${nequi}`)
        .send({ isActive: true })
        .expect(400);
      expect(messageOf(rejected)).toContain('instrucciones');

      await owner
        .patch(`${METHODS}/${nequi}`)
        .send({ isActive: true, instructions: 'Instrucciones de prueba' })
        .expect(200);

      // Activo: no se pueden borrar sus instrucciones.
      await owner.patch(`${METHODS}/${nequi}`).send({ instructions: '' }).expect(400);
    });

    it('el contra entrega se activa sin instrucciones y admite un total máximo', async () => {
      const owner = await loginAgent(app, 'duena@ejemplo.test');
      const res = await owner
        .patch(`${METHODS}/${await methodId('CASH_ON_DELIVERY')}`)
        .send({ isActive: true, maxOrderTotal: 300000 })
        .expect(200);
      expect(res.body).toMatchObject({ isActive: true, maxOrderTotal: 300000 });

      await owner
        .patch(`${METHODS}/${await methodId('BANK_TRANSFER')}`)
        .send({ maxOrderTotal: 300000 })
        .expect(400);
    });

    it('configura los municipios del contra entrega con la lista del DANE', async () => {
      const owner = await loginAgent(app, 'duena@ejemplo.test');
      const cod = await methodId('CASH_ON_DELIVERY');

      const res = await owner
        .put(`${METHODS}/${cod}/cities`)
        .send({ municipalityCodes: ['05001', '11001'] })
        .expect(200);
      expect(res.body).toMatchObject({
        cities: [
          { municipalityCode: '11001', municipalityName: 'Bogotá, D.C.' },
          { municipalityCode: '05001', municipalityName: 'Medellín', departmentName: 'Antioquia' },
        ],
      });

      // Reemplaza la lista completa.
      const replaced = await owner
        .put(`${METHODS}/${cod}/cities`)
        .send({ municipalityCodes: [] })
        .expect(200);
      expect((replaced.body as { cities: unknown[] }).cities).toHaveLength(0);

      await owner
        .put(`${METHODS}/${cod}/cities`)
        .send({ municipalityCodes: ['99999'] })
        .expect(400);
      await owner
        .put(`${METHODS}/${await methodId('NEQUI')}/cities`)
        .send({ municipalityCodes: ['05001'] })
        .expect(400);
    });
  });

  describe('departamentos y municipios', () => {
    it('lista la división oficial sin sesión', async () => {
      const server = app.getHttpServer();
      const departments = await request(server)
        .get('/api/v1/store/locations/departments')
        .expect(200);
      expect(departments.body).toHaveLength(33);

      const antioquia = await request(server)
        .get('/api/v1/store/locations/departments/05/municipalities')
        .expect(200);
      expect(antioquia.body).toContainEqual({ code: '05001', name: 'Medellín' });

      await request(server)
        .get('/api/v1/store/locations/departments/00/municipalities')
        .expect(404);
    });
  });
});
