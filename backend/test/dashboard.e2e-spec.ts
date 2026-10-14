import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const PENDING = '/api/v1/admin/dashboard/pending';

describe('Resumen del panel (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let sequence = 0;

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

  /** Pedido ficticio con los estados indicados. */
  async function order(
    status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED',
    paymentStatus: 'PENDING' | 'AWAITING_VERIFICATION' = 'PENDING',
  ) {
    sequence += 1;
    const method = await prisma.paymentMethod.findUniqueOrThrow({
      where: { code: 'BANK_TRANSFER' },
    });
    const customer = await prisma.customer.upsert({
      where: { phone: '573001112233' },
      create: { fullName: 'Cliente Resumen', phone: '573001112233' },
      update: {},
    });
    return prisma.order.create({
      data: {
        code: `SB-RES-${sequence}`,
        publicTokenHash: `hash-resumen-${sequence}`,
        idempotencyKey: `resumen-${sequence}`,
        requestHash: 'hash',
        customerId: customer.id,
        status,
        paymentStatus,
        customerName: 'Cliente Resumen',
        customerPhone: '573001112233',
        municipalityCode: '44001',
        department: 'La Guajira',
        city: 'Riohacha',
        addressLine: 'Dirección ficticia',
        paymentMethodId: method.id,
        paymentMethodCode: method.code,
        paymentMethodName: method.name,
        subtotal: 10000,
        discountTotal: 0,
        total: 10000,
        termsAcceptedAt: new Date(),
        dataProcessingConsentAt: new Date(),
        ...(status === 'CANCELLED' && { cancelReason: 'Prueba', cancelledAt: new Date() }),
      },
    });
  }

  it('cuenta los pendientes con el mismo criterio de cada sección, para todo el panel', async () => {
    await order('PENDING_CONFIRMATION');
    await order('PENDING_CONFIRMATION');
    await order('CONFIRMED', 'AWAITING_VERIFICATION');
    // Cancelado con comprobante: ya no está por verificar.
    await order('CANCELLED', 'AWAITING_VERIFICATION');
    const withNotice = await order('CONFIRMED');
    await prisma.cancellationNotice.create({
      data: {
        orderId: withNotice.id,
        case: 'NO_PAYMENT_PROOF',
        stage: 'BEFORE',
        deadlineAt: new Date(),
        message: 'Mensaje ficticio.',
      },
    });

    const brand = await prisma.brand.create({ data: { name: 'Marca Resumen', slug: 'marca-res' } });
    const category = await prisma.category.create({
      data: { name: 'Cat Resumen', slug: 'cat-res' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Producto Resumen',
        slug: 'producto-resumen',
        description: 'Producto ficticio.',
        brandId: brand.id,
        categoryId: category.id,
        basePrice: 10000,
      },
    });
    await prisma.productVariant.createMany({
      data: [
        {
          productId: product.id,
          sku: 'RES-1',
          name: 'En el umbral',
          stock: 2,
          lowStockThreshold: 2,
        },
        {
          productId: product.id,
          sku: 'RES-2',
          name: 'Sobre el umbral',
          stock: 5,
          lowStockThreshold: 2,
        },
        { productId: product.id, sku: 'RES-3', name: 'Sin umbral', stock: 0 },
      ],
    });

    const expected = {
      ordersToConfirm: 2,
      paymentsToVerify: 1,
      noticesToSend: 1,
      lowStockVariants: 1,
    };
    for (const email of ['duena@ejemplo.test', 'personal@ejemplo.test']) {
      const agent = await loginAgent(app, email);
      expect((await agent.get(PENDING).expect(200)).body).toEqual(expected);
    }
    await request(app.getHttpServer()).get(PENDING).expect(401);
  });
});
