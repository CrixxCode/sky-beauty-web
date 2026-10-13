import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const ORDERS = '/api/v1/admin/orders';

type Agent = Awaited<ReturnType<typeof loginAgent>>;
type AdminOrder = {
  id: string;
  status: string;
  paymentStatus: string;
  shippingCost: number | null;
  total: number;
  items: Array<{ sku: string; quantity: number; unitFinalPrice: number; unitCost: number | null }>;
};

describe('Gestión de pedidos (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let owner: Agent;
  let staff: Agent;
  let variantId: string;
  let otherVariantId: string;
  let transferId: string;
  let codId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
    await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
    owner = await loginAgent(app, 'duena@ejemplo.test');
    staff = await loginAgent(app, 'personal@ejemplo.test');

    const brand = await prisma.brand.create({ data: { name: 'Marca Pedidos', slug: 'marca-p' } });
    const category = await prisma.category.create({
      data: { name: 'Categoría Pedidos', slug: 'categoria-p' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Producto Pedidos',
        slug: 'producto-pedidos',
        description: 'Producto ficticio.',
        brandId: brand.id,
        categoryId: category.id,
        basePrice: 10000,
        status: 'ACTIVE',
        publishedAt: new Date(Date.now() - 86_400_000),
      },
    });
    const makeVariant = async (sku: string, maxPerOrder: number | null = null) => {
      const v = await prisma.productVariant.create({
        data: { productId: product.id, sku, name: sku, stock: 20, maxPerOrder, costPrice: 4000 },
      });
      await prisma.inventoryMovement.create({
        data: {
          variantId: v.id,
          type: 'INITIAL',
          quantity: 20,
          stockBefore: 0,
          stockAfter: 20,
          reason: '',
        },
      });
      await prisma.variantPriceHistory.create({
        data: { variantId: v.id, price: 10000, validFrom: new Date(Date.now() - 86_400_000) },
      });
      return v.id;
    };
    variantId = await makeVariant('PED-1', 5);
    otherVariantId = await makeVariant('PED-2');

    transferId = (
      await prisma.paymentMethod.update({
        where: { code: 'BANK_TRANSFER' },
        data: { isActive: true, instructions: 'Instrucciones ficticias.' },
      })
    ).id;
    codId = (
      await prisma.paymentMethod.update({
        where: { code: 'CASH_ON_DELIVERY' },
        data: {
          isActive: true,
          restrictToCities: true,
          cities: { create: { municipalityCode: '44001' } },
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  async function createOrder(overrides: Record<string, unknown> = {}): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/store/orders')
      .send({
        items: [{ variantId, quantity: 2 }],
        municipalityCode: '44001',
        customerName: 'Cliente Ficticio',
        customerPhone: '3001112233',
        addressLine: 'Dirección ficticia 123',
        paymentMethodId: transferId,
        idempotencyKey: `pedido-${Date.now()}-${Math.random()}`,
        termsAccepted: true,
        dataProcessingAccepted: true,
        ...overrides,
      })
      .expect(201);
    return (res.body as { id: string }).id;
  }

  const stockOf = async (id: string) =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stock;
  const statusOf = async (id: string) =>
    (await prisma.order.findUniqueOrThrow({ where: { id } })).status;

  describe('bandeja y detalle', () => {
    it('lista con filtros por estado y búsqueda por código, cliente o teléfono', async () => {
      const a = await createOrder();
      await createOrder({ customerName: 'Otra Persona', customerPhone: '3109998877' });
      await owner.patch(`${ORDERS}/${a}/confirm`).send({ shippingCost: 5000 }).expect(200);

      const confirmed = (await staff.get(`${ORDERS}?status=CONFIRMED`).expect(200)).body as {
        items: Array<{ id: string }>;
      };
      expect(confirmed.items.map((o) => o.id)).toEqual([a]);

      const byPhone = (await staff.get(`${ORDERS}?q=3109998877`).expect(200)).body as {
        total: number;
      };
      expect(byPhone.total).toBe(1);
      const byName = (await staff.get(`${ORDERS}?q=otra persona`).expect(200)).body as {
        total: number;
      };
      expect(byName.total).toBe(1);
    });

    it('el personal ve el pedido sin el costo de compra; la propietaria sí lo ve', async () => {
      const id = await createOrder();
      const forStaff = (await staff.get(`${ORDERS}/${id}`).expect(200)).body as AdminOrder;
      expect(forStaff.items[0].unitCost).toBeNull();
      const forOwner = (await owner.get(`${ORDERS}/${id}`).expect(200)).body as AdminOrder;
      expect(forOwner.items[0].unitCost).toBe(4000);
    });

    it('ninguna acción del personal le devuelve el costo de compra', async () => {
      const id = await createOrder();
      const edited = (
        await staff
          .patch(`${ORDERS}/${id}/items`)
          .send({ items: [{ variantId, quantity: 3 }] })
          .expect(200)
      ).body as AdminOrder;
      expect(edited.items[0].unitCost).toBeNull();
      const quoted = (
        await staff.patch(`${ORDERS}/${id}/shipping-cost`).send({ shippingCost: 5000 }).expect(200)
      ).body as AdminOrder;
      expect(quoted.items[0].unitCost).toBeNull();
      const confirmed = (await staff.patch(`${ORDERS}/${id}/confirm`).send({}).expect(200))
        .body as AdminOrder;
      expect(confirmed.items[0].unitCost).toBeNull();
      const preparing = (
        await staff.patch(`${ORDERS}/${id}/status`).send({ status: 'PREPARING' }).expect(200)
      ).body as AdminOrder;
      expect(preparing.items[0].unitCost).toBeNull();
    });
  });

  describe('confirmación y envío', () => {
    it('no confirma sin el costo de envío y recalcula el total al registrarlo', async () => {
      const id = await createOrder(); // 2 × 10.000, envío por confirmar
      await staff.patch(`${ORDERS}/${id}/confirm`).send({}).expect(400);

      const quoted = (
        await staff.patch(`${ORDERS}/${id}/shipping-cost`).send({ shippingCost: 7000 }).expect(200)
      ).body as AdminOrder;
      expect(quoted).toMatchObject({ shippingCost: 7000, total: 27000 });

      const confirmed = (await staff.patch(`${ORDERS}/${id}/confirm`).send({}).expect(200))
        .body as AdminOrder;
      expect(confirmed.status).toBe('CONFIRMED');
      const order = await prisma.order.findUniqueOrThrow({ where: { id } });
      expect(order.confirmedAt).toBeInstanceOf(Date);
    });

    it('confirmar dos veces a la vez solo confirma una vez', async () => {
      const id = await createOrder();
      const results = await Promise.all(
        [1, 2, 3].map(() => staff.patch(`${ORDERS}/${id}/confirm`).send({ shippingCost: 5000 })),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      const history = await prisma.orderStatusHistory.count({
        where: { orderId: id, toStatus: 'CONFIRMED' },
      });
      expect(history).toBe(1);
    });
  });

  describe('cambios de estado', () => {
    it('solo marca en preparación; despachar y entregar se registran en el envío', async () => {
      const id = await createOrder();
      await staff.patch(`${ORDERS}/${id}/status`).send({ status: 'PREPARING' }).expect(400);
      await staff.patch(`${ORDERS}/${id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await staff.patch(`${ORDERS}/${id}/status`).send({ status: 'CONFIRMED' }).expect(400);
      await staff.patch(`${ORDERS}/${id}/status`).send({ status: 'SHIPPED' }).expect(400);
      await staff.patch(`${ORDERS}/${id}/status`).send({ status: 'DELIVERED' }).expect(400);
      await staff
        .patch(`${ORDERS}/${id}/status`)
        .send({ status: 'PREPARING', note: 'Empacando' })
        .expect(200);
      await staff.patch(`${ORDERS}/${id}/status`).send({ status: 'PREPARING' }).expect(400);
      await staff.patch(`${ORDERS}/${id}/status`).send({ status: 'INVENTADO' }).expect(400);

      // Despacho y entrega desde el envío (entrega local).
      await staff
        .patch(`${ORDERS}/${id}/shipping`)
        .send({ method: 'LOCAL', status: 'IN_TRANSIT' })
        .expect(200);
      await staff.patch(`${ORDERS}/${id}/shipping`).send({ status: 'DELIVERED' }).expect(200);

      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId: id, type: 'ORDER_STATUS' },
        orderBy: { createdAt: 'asc' },
      });
      expect(history.map((h) => h.toStatus)).toEqual([
        'PENDING_CONFIRMATION',
        'CONFIRMED',
        'PREPARING',
        'SHIPPED',
        'DELIVERED',
      ]);
      expect(history[2].note).toBe('Empacando');
    });

    it('un pedido contra entrega queda pagado al entregarse', async () => {
      const id = await createOrder({ paymentMethodId: codId });
      await staff.patch(`${ORDERS}/${id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await staff
        .patch(`${ORDERS}/${id}/shipping`)
        .send({ method: 'LOCAL', status: 'IN_TRANSIT' })
        .expect(200);
      const delivered = (
        await staff.patch(`${ORDERS}/${id}/shipping`).send({ status: 'DELIVERED' }).expect(200)
      ).body as AdminOrder;
      expect(delivered.paymentStatus).toBe('PAID');
      const record = await prisma.paymentRecord.findFirstOrThrow({ where: { orderId: id } });
      expect(record.amount.toNumber()).toBe(25000);
    });
  });

  describe('edición de pedidos sin confirmar', () => {
    it('ajusta existencias y totales, y los productos que ya estaban conservan su precio', async () => {
      const id = await createOrder(); // PED-1 × 2 a 10.000
      await prisma.productVariant.update({ where: { id: variantId }, data: { price: 50000 } });

      const edited = (
        await staff
          .patch(`${ORDERS}/${id}/items`)
          .send({
            items: [
              { variantId, quantity: 4 },
              { variantId: otherVariantId, quantity: 1 },
            ],
          })
          .expect(200)
      ).body as AdminOrder;

      const bySku = new Map(edited.items.map((i) => [i.sku, i]));
      expect(bySku.get('PED-1')).toMatchObject({ quantity: 4, unitFinalPrice: 10000 });
      expect(bySku.get('PED-2')).toMatchObject({ quantity: 1, unitFinalPrice: 10000 });
      expect(edited.total).toBe(50000);
      expect(await stockOf(variantId)).toBe(16);
      expect(await stockOf(otherVariantId)).toBe(19);

      const events = await prisma.orderStatusHistory.count({
        where: { orderId: id, type: 'ITEMS_CHANGED' },
      });
      expect(events).toBe(1);
    });

    it('los productos agregados toman el precio y la promoción del día del pedido', async () => {
      // Promoción vigente al hacer el pedido que vence antes de la edición.
      const start = new Date(Date.now() - 3_600_000);
      const promotion = await prisma.promotion.create({
        data: {
          name: 'Promo del día',
          discountType: 'PERCENTAGE',
          discountValue: 20,
          scope: 'VARIANT',
          startsAt: start,
          endsAt: new Date(Date.now() + 3_600_000),
          createdAt: start,
          variants: { create: { variantId: otherVariantId } },
        },
      });
      await prisma.promotionRevision.create({
        data: {
          promotionId: promotion.id,
          revision: 1,
          validFrom: start,
          name: promotion.name,
          discountType: 'PERCENTAGE',
          discountValue: 20,
          scope: 'VARIANT',
          startsAt: promotion.startsAt,
          endsAt: promotion.endsAt,
          isActive: true,
          variantIds: [otherVariantId],
        },
      });
      const id = await createOrder();

      // Después del pedido: la promoción se desactiva y sube el precio.
      await prisma.promotionRevision.create({
        data: {
          promotionId: promotion.id,
          revision: 2,
          name: promotion.name,
          discountType: 'PERCENTAGE',
          discountValue: 20,
          scope: 'VARIANT',
          startsAt: promotion.startsAt,
          endsAt: promotion.endsAt,
          isActive: false,
          variantIds: [otherVariantId],
        },
      });
      await prisma.variantPriceHistory.create({
        data: { variantId: otherVariantId, price: 30000 },
      });

      const edited = (
        await staff
          .patch(`${ORDERS}/${id}/items`)
          .send({
            items: [
              { variantId, quantity: 2 },
              { variantId: otherVariantId, quantity: 1 },
            ],
          })
          .expect(200)
      ).body as AdminOrder & { items: Array<{ sku: string; unitDiscount: number }> };
      const added = edited.items.find((i) => i.sku === 'PED-2');
      expect(added).toMatchObject({ unitFinalPrice: 8000, unitDiscount: 2000 });
    });

    it('respeta el máximo por pedido también al aumentar un producto que ya estaba', async () => {
      const id = await createOrder();
      await staff
        .patch(`${ORDERS}/${id}/items`)
        .send({ items: [{ variantId, quantity: 6 }] })
        .expect(400);
      expect(await stockOf(variantId)).toBe(18);
    });

    it('no se edita un pedido confirmado ni se deja sin productos', async () => {
      const id = await createOrder();
      await staff.patch(`${ORDERS}/${id}/items`).send({ items: [] }).expect(400);
      await staff.patch(`${ORDERS}/${id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await staff
        .patch(`${ORDERS}/${id}/items`)
        .send({ items: [{ variantId, quantity: 1 }] })
        .expect(400);
    });
  });

  describe('envío al editar un pedido sin confirmar', () => {
    const editTo = async (id: string, quantity: number) =>
      (
        await staff
          .patch(`${ORDERS}/${id}/items`)
          .send({ items: [{ variantId: otherVariantId, quantity }] })
          .expect(200)
      ).body as AdminOrder;

    it('se recalcula con la tarifa del municipio y el monto mínimo de envío gratis', async () => {
      await prisma.municipalShippingRate.create({
        data: { municipalityCode: '44001', amount: 5000 },
      });
      await prisma.storeSettings.update({
        where: { id: 'default' },
        data: { freeShippingThreshold: 40000 },
      });
      const id = await createOrder({ items: [{ variantId: otherVariantId, quantity: 2 }] });
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id } })).shippingCost?.toNumber(),
      ).toBe(5000);

      expect(await editTo(id, 4)).toMatchObject({ shippingCost: 0, total: 40000 });
      expect(await editTo(id, 2)).toMatchObject({ shippingCost: 5000, total: 25000 });

      const notes = await prisma.orderStatusHistory.findMany({
        where: { orderId: id, type: 'SHIPPING' },
        orderBy: { createdAt: 'asc' },
      });
      const nbsp = String.fromCharCode(160);
      expect(notes.map((n) => n.note?.replaceAll(nbsp, ' '))).toEqual([
        'Envío recalculado al editar: Envío gratis.',
        'Envío recalculado al editar: Envío: $ 5.000.',
      ]);
    });

    it('sin tarifa conserva el costo cotizado a mano, salvo que pase a ser gratis', async () => {
      await prisma.storeSettings.update({
        where: { id: 'default' },
        data: { freeShippingThreshold: 40000 },
      });
      const id = await createOrder({
        municipalityCode: '05001',
        items: [{ variantId: otherVariantId, quantity: 2 }],
      });
      await staff.patch(`${ORDERS}/${id}/shipping-cost`).send({ shippingCost: 12000 }).expect(200);

      expect(await editTo(id, 3)).toMatchObject({ shippingCost: 12000, total: 42000 });
      expect(await editTo(id, 4)).toMatchObject({ shippingCost: 0 });
      // Deja de ser gratis y no hay tarifa: vuelve a quedar por confirmar.
      expect(await editTo(id, 2)).toMatchObject({ shippingCost: null, total: 20000 });
    });

    it('con envío gratis nacional activo queda gratis', async () => {
      const id = await createOrder({
        municipalityCode: '05001',
        items: [{ variantId: otherVariantId, quantity: 1 }],
      });
      await prisma.storeSettings.update({
        where: { id: 'default' },
        data: { nationalFreeShipping: true },
      });
      expect(await editTo(id, 2)).toMatchObject({ shippingCost: 0, total: 20000 });
    });
  });

  describe('cancelación manual', () => {
    it('exige motivo, libera existencias y deja el motivo en el pedido', async () => {
      const id = await createOrder();
      await owner.patch(`${ORDERS}/${id}/cancel`).send({ reason: '   ' }).expect(400);
      await owner
        .patch(`${ORDERS}/${id}/cancel`)
        .send({ reason: 'El cliente desistió' })
        .expect(200);
      expect(await stockOf(variantId)).toBe(20);
      const order = await prisma.order.findUniqueOrThrow({ where: { id } });
      expect(order).toMatchObject({ status: 'CANCELLED', cancelReason: 'El cliente desistió' });
    });

    it('el personal solo cancela por pago no demostrado vencido', async () => {
      const id = await createOrder();
      await staff.patch(`${ORDERS}/${id}/cancel`).send({ reason: 'Intento' }).expect(403);
      expect(await statusOf(id)).toBe('PENDING_CONFIRMATION');
    });

    it('no cancela pedidos despachados ni entregados', async () => {
      const id = await createOrder();
      await owner.patch(`${ORDERS}/${id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await owner
        .patch(`${ORDERS}/${id}/shipping`)
        .send({ method: 'LOCAL', status: 'IN_TRANSIT' })
        .expect(200);
      await owner.patch(`${ORDERS}/${id}/cancel`).send({ reason: 'Tarde' }).expect(400);
    });

    it('confirmar y cancelar a la vez deja un estado coherente con las existencias', async () => {
      const id = await createOrder();
      await Promise.all([
        owner.patch(`${ORDERS}/${id}/confirm`).send({ shippingCost: 5000 }),
        owner.patch(`${ORDERS}/${id}/cancel`).send({ reason: 'Cancelación simultánea' }),
      ]);
      const status = await statusOf(id);
      expect(await stockOf(variantId)).toBe(status === 'CANCELLED' ? 20 : 18);
      if (status === 'CANCELLED') {
        const order = await prisma.order.findUniqueOrThrow({ where: { id } });
        expect(order.cancelReason).toBe('Cancelación simultánea');
      }
    });
  });
});
