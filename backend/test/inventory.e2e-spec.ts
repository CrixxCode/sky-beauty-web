import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const INVENTORY = '/api/v1/admin/inventory';

type MovementsResponse = {
  total: number;
  items: Array<{ stockAfter: number }>;
};

describe('Inventario (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let variantId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
    await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });

    const brand = await prisma.brand.create({
      data: { name: 'Marca Inventario Test', slug: 'marca-inventario-test' },
    });
    const category = await prisma.category.create({
      data: { name: 'Categoría Inventario Test', slug: 'categoria-inventario-test' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Producto Inventario Test',
        slug: 'producto-inventario-test',
        description: 'Producto ficticio para pruebas de inventario.',
        brandId: brand.id,
        categoryId: category.id,
        basePrice: 25000,
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: 'INV-TEST-001',
        name: 'Tono prueba',
        stock: 0,
        lowStockThreshold: 2,
      },
    });
    variantId = variant.id;
  });

  afterAll(() => app.close());

  it('registra entradas y ajustes, actualiza stock y deja historial', async () => {
    const staff = await loginAgent(app, 'personal@ejemplo.test');

    await staff
      .post(`${INVENTORY}/movements`)
      .send({
        variantId,
        type: 'INITIAL',
        quantity: 5,
        reason: 'Conteo inicial de prueba',
      })
      .expect(201);

    await staff
      .post(`${INVENTORY}/movements`)
      .send({
        variantId,
        type: 'PURCHASE',
        quantity: 8,
        reason: 'Compra ficticia a proveedor',
      })
      .expect(201);

    const adjustment = await staff
      .post(`${INVENTORY}/movements`)
      .send({
        variantId,
        type: 'ADJUSTMENT',
        quantity: -3,
        reason: 'Ajuste por conteo físico',
      })
      .expect(201);

    expect(adjustment.body).toMatchObject({
      quantity: -3,
      stockBefore: 13,
      stockAfter: 10,
      reason: 'Ajuste por conteo físico',
    });

    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.stock).toBe(10);

    const history = await staff.get(`${INVENTORY}/movements?variantId=${variantId}`).expect(200);
    const historyBody = history.body as MovementsResponse;
    expect(historyBody.total).toBe(3);
    expect(historyBody.items.map((item) => item.stockAfter)).toEqual([10, 13, 5]);
  });

  it('no permite dejar existencias negativas ni repetir existencias iniciales', async () => {
    const owner = await loginAgent(app, 'duena@ejemplo.test');

    await owner
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'ADJUSTMENT', quantity: -1, reason: 'Ajuste inválido' })
      .expect(400);

    await owner
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'INITIAL', quantity: 2, reason: 'Conteo inicial' })
      .expect(201);

    await owner
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'INITIAL', quantity: 1, reason: 'Segundo conteo inicial' })
      .expect(409);
  });

  it('una cantidad fuera de rango responde 400, no 500', async () => {
    const owner = await loginAgent(app, 'duena@ejemplo.test');
    await owner
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'PURCHASE', quantity: 3_000_000_000 })
      .expect(400);
  });

  it('lista existencias por variante y filtra alertas de stock bajo', async () => {
    const staff = await loginAgent(app, 'personal@ejemplo.test');

    await staff
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'INITIAL', quantity: 1, reason: 'Conteo inicial bajo' })
      .expect(201);

    const lowStock = await staff.get(`${INVENTORY}/variants?lowStock=true`).expect(200);
    expect(lowStock.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantId,
          stock: 1,
          lowStockThreshold: 2,
          isLowStock: true,
        }),
      ]),
    );

    await staff
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'PURCHASE', quantity: 5, reason: 'Reposición ficticia' })
      .expect(201);

    const noLowStock = await staff.get(`${INVENTORY}/variants?lowStock=true`).expect(200);
    expect(noLowStock.body).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ variantId })]),
    );
  });

  it('exige justificación solo en los ajustes', async () => {
    const staff = await loginAgent(app, 'personal@ejemplo.test');

    await staff
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'PURCHASE', quantity: 4 })
      .expect(201);
    await staff
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'ADJUSTMENT', quantity: -1, reason: '   ' })
      .expect(400);
    await staff
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'ADJUSTMENT', quantity: -1 })
      .expect(400);

    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.stock).toBe(4);
  });

  it('no registra movimientos de pedidos desde el inventario', async () => {
    const owner = await loginAgent(app, 'duena@ejemplo.test');
    for (const type of ['ORDER_RESERVED', 'ORDER_RELEASED', 'RETURN']) {
      await owner
        .post(`${INVENTORY}/movements`)
        .send({ variantId, type, quantity: 1, reason: 'No permitido' })
        .expect(400);
    }
  });

  it('el historial indica variante, fecha y quién registró el movimiento', async () => {
    const staff = await loginAgent(app, 'personal@ejemplo.test');
    await staff
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'INITIAL', quantity: 3 })
      .expect(201);

    const history = await staff.get(`${INVENTORY}/movements`).expect(200);
    expect((history.body as { items: unknown[] }).items[0]).toMatchObject({
      productName: 'Producto Inventario Test',
      variantName: 'Tono prueba',
      sku: 'INV-TEST-001',
      createdByName: 'Usuario de prueba',
      createdAt: expect.any(String) as unknown,
    });
  });

  it('dos existencias iniciales simultáneas: solo una se registra', async () => {
    const owner = await loginAgent(app, 'duena@ejemplo.test');
    const results = await Promise.all(
      [4, 6].map((quantity) =>
        owner.post(`${INVENTORY}/movements`).send({ variantId, type: 'INITIAL', quantity }),
      ),
    );
    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);

    const initial = await prisma.inventoryMovement.findMany({
      where: { variantId, type: 'INITIAL' },
    });
    expect(initial).toHaveLength(1);
    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.stock).toBe(initial[0].quantity);
  });

  it('movimientos simultáneos no se pisan y nunca dejan existencias negativas', async () => {
    const owner = await loginAgent(app, 'duena@ejemplo.test');
    await owner
      .post(`${INVENTORY}/movements`)
      .send({ variantId, type: 'INITIAL', quantity: 5 })
      .expect(201);

    // Ocho salidas de 1 unidad a la vez sobre 5 existencias: solo 5 pueden aplicarse.
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        owner
          .post(`${INVENTORY}/movements`)
          .send({ variantId, type: 'ADJUSTMENT', quantity: -1, reason: 'Salida simultánea' }),
      ),
    );
    expect(results.filter((res) => res.status === 201)).toHaveLength(5);

    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.stock).toBe(0);

    // El historial cuadra con el stock.
    const movements = await prisma.inventoryMovement.findMany({ where: { variantId } });
    expect(movements.reduce((sum, m) => sum + m.quantity, 0)).toBe(variant.stock);
  });

  it('lowStock=false lista todas las variantes y sin umbral no hay alerta', async () => {
    const staff = await loginAgent(app, 'personal@ejemplo.test');
    await prisma.productVariant.update({
      where: { id: variantId },
      data: { lowStockThreshold: null },
    });

    const all = await staff.get(`${INVENTORY}/variants?lowStock=false`).expect(200);
    expect(all.body).toEqual([expect.objectContaining({ variantId, isLowStock: false })]);

    const low = await staff.get(`${INVENTORY}/variants?lowStock=true`).expect(200);
    expect(low.body).toEqual([]);
  });

  it('el inventario exige sesión', async () => {
    await request(app.getHttpServer()).get(`${INVENTORY}/variants`).expect(401);
  });
});
