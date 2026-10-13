import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const STORE_ORDERS = '/api/v1/store/orders';
const ADMIN_ORDERS = '/api/v1/admin/orders';
const INITIAL_STOCK = 10;

describe('Existencias de los pedidos (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let variantId: string;
  let paymentMethodId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test' });

    const brand = await prisma.brand.create({
      data: { name: 'Marca Pedidos Test', slug: 'marca-pedidos-test' },
    });
    const category = await prisma.category.create({
      data: { name: 'Categoría Pedidos Test', slug: 'categoria-pedidos-test' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Producto Pedidos Test',
        slug: 'producto-pedidos-test',
        description: 'Producto ficticio para pruebas de pedidos.',
        brandId: brand.id,
        categoryId: category.id,
        basePrice: 20000,
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'PED-TEST-001',
        name: 'Tono prueba',
        stock: INITIAL_STOCK,
      },
    });
    variantId = variant.id;
    await prisma.inventoryMovement.create({
      data: {
        variantId,
        type: 'INITIAL',
        quantity: INITIAL_STOCK,
        stockBefore: 0,
        stockAfter: INITIAL_STOCK,
        reason: '',
      },
    });

    const method = await prisma.paymentMethod.update({
      where: { code: 'BANK_TRANSFER' },
      data: { isActive: true, instructions: 'Instrucciones ficticias de prueba.' },
    });
    paymentMethodId = method.id;
  });

  afterAll(() => app.close());

  async function createOrder(quantity: number): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(STORE_ORDERS)
      .send({
        items: [{ variantId, quantity }],
        municipalityCode: '44001',
        customerName: 'Cliente Ficticio',
        customerPhone: '3001112233',
        addressLine: 'Dirección ficticia de prueba',
        paymentMethodId,
        idempotencyKey: `pedido-${Date.now()}-${Math.random()}`,
        termsAccepted: true,
        dataProcessingAccepted: true,
      })
      .expect(201);
    return (
      await prisma.order.findFirstOrThrow({ where: { code: (res.body as { code: string }).code } })
    ).id;
  }

  /** El stock de la variante es igual a la suma de sus movimientos. */
  async function expectHistoryMatchesStock(): Promise<number> {
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    const movements = await prisma.inventoryMovement.findMany({ where: { variantId } });
    expect(movements.reduce((sum, m) => sum + m.quantity, 0)).toBe(variant.stock);
    for (const m of movements) expect(m.stockAfter).toBe(m.stockBefore + m.quantity);
    return variant.stock;
  }

  it('al crear el pedido reserva existencias y deja el movimiento', async () => {
    await createOrder(3);
    expect(await expectHistoryMatchesStock()).toBe(INITIAL_STOCK - 3);
  });

  it('cancelaciones simultáneas liberan las existencias una sola vez', async () => {
    const orderId = await createOrder(2);
    const owner = await loginAgent(app, 'duena@ejemplo.test');

    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        owner.patch(`${ADMIN_ORDERS}/${orderId}/cancel`).send({ reason: 'Cancelación de prueba' }),
      ),
    );
    expect(results.filter((res) => res.status === 200)).toHaveLength(1);

    expect(await expectHistoryMatchesStock()).toBe(INITIAL_STOCK);
    const released = await prisma.inventoryMovement.count({
      where: { orderId, type: 'ORDER_RELEASED' },
    });
    expect(released).toBe(1);
  });

  it('ediciones simultáneas no reservan sobre datos desactualizados', async () => {
    const orderId = await createOrder(2);
    const owner = await loginAgent(app, 'duena@ejemplo.test');

    const results = await Promise.all(
      [5, 3, 1].map((quantity) =>
        owner.patch(`${ADMIN_ORDERS}/${orderId}/items`).send({ items: [{ variantId, quantity }] }),
      ),
    );
    expect(results.filter((res) => res.status === 200).length).toBeGreaterThanOrEqual(1);
    for (const res of results) expect([200, 409]).toContain(res.status);

    // Lo reservado coincide con la cantidad final del pedido.
    const items = await prisma.orderItem.findMany({ where: { orderId } });
    const ordered = items.reduce((sum, item) => sum + item.quantity, 0);
    expect(await expectHistoryMatchesStock()).toBe(INITIAL_STOCK - ordered);
  });
});
