import type { NestExpressApplication } from '@nestjs/platform-express';
import { createHash } from 'node:crypto';
import request from 'supertest';
import { seed } from '../prisma/seed';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createTestApp } from './utils/app';
import { resetDatabase } from './utils/database';

const TRACKING = '/api/v1/store/orders/tracking';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

interface TrackingResponse {
  code: string;
  status: string;
  paymentStatus: string;
  paymentMethodName: string;
  shippingCost: number | null;
  total: number;
  shipping: {
    status: string;
    carrierName: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
  } | null;
}

interface ErrorResponse {
  message: string;
}

describe('Seguimiento publico de pedidos (integracion)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);
  });

  afterAll(() => app.close());

  it('muestra estados, guia y enlace sin exponer datos internos del envio', async () => {
    const token = '0123456789abcdef0123456789abcdef0123456789abcdef';
    const paymentMethod = await prisma.paymentMethod.findUniqueOrThrow({
      where: { code: 'BANK_TRANSFER' },
    });
    const customer = await prisma.customer.create({
      data: { fullName: 'Cliente Seguimiento', phone: '573001112233' },
    });
    const carrier = await prisma.carrier.create({
      data: {
        name: 'Transportadora Test',
        trackingUrlTemplate: 'https://rastreo.test/{tracking}',
      },
    });
    const order = await prisma.order.create({
      data: {
        code: 'SB-TRACK-001',
        publicTokenHash: sha256(token),
        idempotencyKey: 'tracking-test-001',
        requestHash: 'request-hash-test',
        customerId: customer.id,
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        customerName: 'Cliente Seguimiento',
        customerPhone: '573001112233',
        municipalityCode: '44001',
        department: 'La Guajira',
        city: 'Riohacha',
        addressLine: 'Direccion ficticia de prueba',
        paymentMethodId: paymentMethod.id,
        paymentMethodCode: paymentMethod.code,
        paymentMethodName: paymentMethod.name,
        subtotal: 50000,
        discountTotal: 0,
        shippingCost: 5000,
        total: 55000,
        termsAcceptedAt: new Date(),
        dataProcessingConsentAt: new Date(),
      },
    });
    await prisma.shipping.create({
      data: {
        orderId: order.id,
        carrierId: carrier.id,
        trackingNumber: 'GUIA-123',
        carrierCost: 4200,
        status: 'IN_TRANSIT',
        dispatchedAt: new Date('2026-10-13T10:00:00Z'),
        notes: 'Nota interna que no debe salir',
      },
    });

    const res = await request(app.getHttpServer()).get(`${TRACKING}/${token}`).expect(200);

    const body = res.body as TrackingResponse;
    expect(body).toMatchObject({
      code: 'SB-TRACK-001',
      status: 'SHIPPED',
      paymentStatus: 'PAID',
      paymentMethodName: 'Transferencia bancaria',
      shippingCost: 5000,
      total: 55000,
      shipping: {
        status: 'IN_TRANSIT',
        carrierName: 'Transportadora Test',
        trackingNumber: 'GUIA-123',
        trackingUrl: 'https://rastreo.test/GUIA-123',
      },
    });
    expect(body).not.toHaveProperty('customerPhone');
    expect(body).not.toHaveProperty('addressLine');
    expect(body.shipping).not.toHaveProperty('carrierCost');
    expect(body.shipping).not.toHaveProperty('notes');
  });

  it('responde el mismo 404 genérico para cualquier enlace inválido', async () => {
    for (const token of [
      'token-invalido',
      'a'.repeat(48), // formato válido pero no existe
      'A'.repeat(47),
      `${'b'.repeat(48)}x`,
    ]) {
      const res = await request(app.getHttpServer()).get(`${TRACKING}/${token}`).expect(404);
      expect((res.body as ErrorResponse).message).toBe('No existe ese enlace de seguimiento.');
    }
  });

  it('muestra productos y totales del pedido sin datos internos ni del cliente', async () => {
    const brand = await prisma.brand.create({ data: { name: 'Marca Seg', slug: 'marca-seg' } });
    const category = await prisma.category.create({
      data: { name: 'Categoría Seg', slug: 'cat-seg' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Producto Seguimiento',
        slug: 'producto-seguimiento',
        description: 'Producto ficticio.',
        brandId: brand.id,
        categoryId: category.id,
        basePrice: 15000,
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'SEG-1',
        name: 'Tono seguimiento',
        stock: 5,
        costPrice: 6000,
      },
    });
    const method = await prisma.paymentMethod.update({
      where: { code: 'BANK_TRANSFER' },
      data: { isActive: true, instructions: 'Instrucciones ficticias.' },
    });
    const created = await request(app.getHttpServer())
      .post('/api/v1/store/orders')
      .send({
        items: [{ variantId: variant.id, quantity: 2 }],
        municipalityCode: '44001',
        customerName: 'Cliente Privado',
        customerPhone: '3001112233',
        addressLine: 'Dirección privada 123',
        deliveryNotes: 'Nota privada del cliente',
        paymentMethodId: method.id,
        idempotencyKey: `seguimiento-${Date.now()}`,
        termsAccepted: true,
        dataProcessingAccepted: true,
      })
      .expect(201);
    const { publicToken } = created.body as { publicToken: string };

    const res = await request(app.getHttpServer()).get(`${TRACKING}/${publicToken}`).expect(200);
    expect(res.body).toMatchObject({
      items: [
        {
          productName: 'Producto Seguimiento',
          variantName: 'Tono seguimiento',
          quantity: 2,
          unitFinalPrice: 15000,
          lineTotal: 30000,
        },
      ],
      subtotal: 30000,
      discountTotal: 0,
      shippingCost: null,
      total: 30000,
    });
    const raw = JSON.stringify(res.body);
    for (const secret of [
      'Cliente Privado',
      '573001112233',
      'Dirección privada',
      'Nota privada',
      'unitCost',
      '6000',
      'customerId',
      'paymentMethodId',
      'idempotencyKey',
      'publicTokenHash',
    ]) {
      expect(raw).not.toContain(secret);
    }
    expect(res.body).not.toHaveProperty('id');
  });

  describe('rastreador por código y teléfono', () => {
    const LOOKUP = '/api/v1/store/orders/lookup';
    let code: string;
    let publicToken: string;

    beforeEach(async () => {
      const brand = await prisma.brand.create({
        data: { name: 'Marca Rastreo', slug: 'marca-rastreo' },
      });
      const category = await prisma.category.create({
        data: { name: 'Categoría Rastreo', slug: 'cat-rastreo' },
      });
      const product = await prisma.product.create({
        data: {
          name: 'Producto Rastreo',
          slug: 'producto-rastreo',
          description: 'Producto ficticio.',
          brandId: brand.id,
          categoryId: category.id,
          basePrice: 10000,
          status: 'ACTIVE',
          publishedAt: new Date(),
        },
      });
      const variant = await prisma.productVariant.create({
        data: { productId: product.id, sku: 'RAS-1', name: 'Tono rastreo', stock: 5 },
      });
      const method = await prisma.paymentMethod.update({
        where: { code: 'BANK_TRANSFER' },
        data: { isActive: true, instructions: 'Instrucciones ficticias.' },
      });
      const created = await request(app.getHttpServer())
        .post('/api/v1/store/orders')
        .send({
          items: [{ variantId: variant.id, quantity: 1 }],
          municipalityCode: '44001',
          customerName: 'Cliente Rastreo',
          customerPhone: '300 111 2233',
          addressLine: 'Dirección ficticia 123',
          paymentMethodId: method.id,
          idempotencyKey: `rastreo-${Date.now()}`,
          termsAccepted: true,
          dataProcessingAccepted: true,
        })
        .expect(201);
      ({ code, publicToken } = created.body as { code: string; publicToken: string });
    });

    it('con código y teléfono correctos lleva al seguimiento privado', async () => {
      for (const phone of ['3001112233', '+57 300 111 2233', '573001112233']) {
        const res = await request(app.getHttpServer())
          .post(LOOKUP)
          .send({ code: ` ${code.toLowerCase()} `, phone })
          .expect(200);
        expect(res.body).toEqual({ trackingPath: `/seguimiento/${publicToken}` });
      }
      await request(app.getHttpServer()).get(`${TRACKING}/${publicToken}`).expect(200);
    });

    it('si algún dato no coincide responde siempre el mismo error genérico', async () => {
      for (const body of [
        { code, phone: '3009999999' },
        { code: 'SB-000000-000000', phone: '3001112233' },
        { code, phone: 'teléfono raro' },
      ]) {
        const res = await request(app.getHttpServer()).post(LOOKUP).send(body).expect(404);
        expect((res.body as ErrorResponse).message).toBe(
          'No encontramos un pedido con esos datos.',
        );
      }
      await request(app.getHttpServer()).post(LOOKUP).send({ code }).expect(400);
    });
  });
});
