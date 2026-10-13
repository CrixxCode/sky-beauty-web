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

  it('responde 404 generico para enlaces invalidos', async () => {
    const res = await request(app.getHttpServer()).get(`${TRACKING}/token-invalido`).expect(404);
    expect((res.body as ErrorResponse).message).toBe('No existe ese enlace de seguimiento.');
  });
});
