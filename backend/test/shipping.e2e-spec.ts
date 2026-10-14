import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const ORDERS = '/api/v1/admin/orders';
const CARRIERS = '/api/v1/admin/carriers';

type Agent = Awaited<ReturnType<typeof loginAgent>>;
type AdminOrder = {
  status: string;
  paymentStatus: string;
  shipping: {
    status: string;
    trackingNumber: string | null;
    trackingUrl: string | null;
    dispatchedAt: string | null;
    deliveredAt: string | null;
  } | null;
};
type Tracking = {
  status: string;
  shipping: { status: string; trackingNumber: string | null; trackingUrl: string | null } | null;
};

describe('Envíos (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let owner: Agent;
  let staff: Agent;
  let variantId: string;
  let transferId: string;
  let codId: string;
  let carrierId: string;

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

    const brand = await prisma.brand.create({
      data: { name: 'Marca Envíos', slug: 'marca-envios' },
    });
    const category = await prisma.category.create({
      data: { name: 'Categoría Envíos', slug: 'categoria-envios' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Producto Envíos',
        slug: 'producto-envios',
        description: 'Producto ficticio.',
        brandId: brand.id,
        categoryId: category.id,
        basePrice: 10000,
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });
    variantId = (
      await prisma.productVariant.create({
        data: { productId: product.id, sku: 'ENV-1', name: 'Tono envíos', stock: 10 },
      })
    ).id;
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
    carrierId = (
      (
        await staff
          .post(CARRIERS)
          .send({
            name: 'Transportadora Ficticia',
            trackingUrlTemplate: 'https://rastreo.ejemplo.test/guia/{tracking}',
          })
          .expect(201)
      ).body as { id: string }
    ).id;
  });

  afterAll(() => app.close());

  /** Pedido confirmado; devuelve su id y el token del enlace privado. */
  async function confirmedOrder(paymentMethodId = transferId) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/store/orders')
      .send({
        items: [{ variantId, quantity: 1 }],
        municipalityCode: '44001',
        customerName: 'Cliente Ficticio',
        customerPhone: '3001112233',
        addressLine: 'Dirección ficticia 123',
        paymentMethodId,
        idempotencyKey: `envio-${Date.now()}-${Math.random()}`,
        termsAccepted: true,
        dataProcessingAccepted: true,
      })
      .expect(201);
    const { id, publicToken } = res.body as { id: string; publicToken: string };
    await staff.patch(`${ORDERS}/${id}/confirm`).send({ shippingCost: 5000 }).expect(200);
    return { id, token: publicToken };
  }

  const ship = (id: string, body: Record<string, unknown>) =>
    staff.patch(`${ORDERS}/${id}/shipping`).send(body);
  const track = async (token: string) =>
    (await request(app.getHttpServer()).get(`/api/v1/store/orders/tracking/${token}`).expect(200))
      .body as Tracking;

  describe('transportadoras', () => {
    it('el personal las gestiona; el nombre no se repite y la plantilla lleva {tracking}', async () => {
      await staff.post(CARRIERS).send({ name: 'Transportadora Ficticia' }).expect(409);
      await staff
        .post(CARRIERS)
        .send({ name: 'Otra', trackingUrlTemplate: 'https://rastreo.ejemplo.test/sin-marcador' })
        .expect(400);
      await staff
        .post(CARRIERS)
        .send({ name: 'Otra', trackingUrlTemplate: 'no-es-url' })
        .expect(400);
      await staff.post(CARRIERS).send({ name: '   ' }).expect(400);

      const other = (await staff.post(CARRIERS).send({ name: 'Otra' }).expect(201)).body as {
        id: string;
      };
      await staff
        .patch(`${CARRIERS}/${other.id}`)
        .send({ name: 'Transportadora Ficticia' })
        .expect(409);
      await staff.patch(`${CARRIERS}/${other.id}`).send({ isActive: false }).expect(200);
      const list = (await staff.get(CARRIERS).expect(200)).body as Array<{
        name: string;
        isActive: boolean;
      }>;
      expect(list.map((c) => [c.name, c.isActive])).toEqual([
        ['Transportadora Ficticia', true],
        ['Otra', false],
      ]);
    });
  });

  describe('registro del envío', () => {
    it('se despacha con transportadora y guía, y el cliente ve el rastreo', async () => {
      const { id, token } = await confirmedOrder();
      await ship(id, { status: 'IN_TRANSIT', carrierId }).expect(400);

      const shipped = (
        await ship(id, {
          status: 'IN_TRANSIT',
          carrierId,
          trackingNumber: 'GUIA 001',
          carrierCost: 4200,
        }).expect(200)
      ).body as AdminOrder;
      expect(shipped.status).toBe('SHIPPED');
      expect(shipped.shipping).toMatchObject({ status: 'IN_TRANSIT', trackingNumber: 'GUIA 001' });
      expect(shipped.shipping?.dispatchedAt).not.toBeNull();

      const tracking = await track(token);
      expect(tracking.shipping).toMatchObject({
        status: 'IN_TRANSIT',
        trackingNumber: 'GUIA 001',
        trackingUrl: 'https://rastreo.ejemplo.test/guia/GUIA%20001',
      });
      expect(JSON.stringify(tracking)).not.toContain('4200');

      const delivered = (await ship(id, { status: 'DELIVERED' }).expect(200)).body as AdminOrder;
      expect(delivered.status).toBe('DELIVERED');
      expect(delivered.shipping?.deliveredAt).not.toBeNull();
    });

    it('un envío entregado no retrocede, pero sus datos se pueden corregir', async () => {
      const { id } = await confirmedOrder();
      await ship(id, { status: 'IN_TRANSIT', carrierId, trackingNumber: 'G-1' }).expect(200);
      await ship(id, { status: 'DELIVERED' }).expect(200);
      await ship(id, { status: 'IN_TRANSIT' }).expect(400);
      await ship(id, { status: 'NOT_SHIPPED' }).expect(400);
      const fixed = (await ship(id, { status: 'DELIVERED', trackingNumber: 'G-1-B' }).expect(200))
        .body as AdminOrder;
      expect(fixed).toMatchObject({ status: 'DELIVERED', shipping: { trackingNumber: 'G-1-B' } });
    });

    it('una novedad puede volver a tránsito y terminar en entrega', async () => {
      const { id } = await confirmedOrder();
      await ship(id, { status: 'IN_TRANSIT', carrierId, trackingNumber: 'G-2' }).expect(200);
      const incident = (
        await ship(id, { status: 'INCIDENT', notes: 'Dirección errada' }).expect(200)
      ).body as AdminOrder;
      expect(incident.status).toBe('SHIPPED');
      await ship(id, { status: 'IN_TRANSIT' }).expect(200);
      await ship(id, { status: 'DELIVERED' }).expect(200);
    });

    it('valida fechas y no despacha pedidos sin confirmar ni cancelados', async () => {
      const { id } = await confirmedOrder();
      await ship(id, {
        status: 'IN_TRANSIT',
        carrierId,
        trackingNumber: 'G-3',
        dispatchedAt: '2026-10-10T10:00:00.000Z',
        deliveredAt: '2026-10-09T10:00:00.000Z',
      }).expect(400);

      const pending = await request(app.getHttpServer())
        .post('/api/v1/store/orders')
        .send({
          items: [{ variantId, quantity: 1 }],
          municipalityCode: '44001',
          customerName: 'Cliente Ficticio',
          customerPhone: '3001112233',
          addressLine: 'Dirección ficticia 123',
          paymentMethodId: transferId,
          idempotencyKey: `envio-pendiente-${Date.now()}`,
          termsAccepted: true,
          dataProcessingAccepted: true,
        })
        .expect(201);
      const pendingId = (pending.body as { id: string }).id;
      await ship(pendingId, { status: 'IN_TRANSIT', carrierId, trackingNumber: 'G-4' }).expect(400);
      // Registrar la transportadora antes de confirmar sí se permite.
      await ship(pendingId, { status: 'NOT_SHIPPED', carrierId }).expect(200);

      await owner
        .patch(`${ORDERS}/${pendingId}/cancel`)
        .send({ reason: 'Prueba de cancelación' })
        .expect(200);
      await ship(pendingId, { status: 'NOT_SHIPPED', trackingNumber: 'G-5' }).expect(400);
    });

    it('no se elige una transportadora desactivada, pero el envío que ya la usa se corrige', async () => {
      const { id } = await confirmedOrder();
      await ship(id, { status: 'IN_TRANSIT', carrierId, trackingNumber: 'G-6' }).expect(200);
      await staff.patch(`${CARRIERS}/${carrierId}`).send({ isActive: false }).expect(200);
      await ship(id, { status: 'IN_TRANSIT', trackingNumber: 'G-6-B' }).expect(200);

      const other = await confirmedOrder();
      await ship(other.id, { status: 'IN_TRANSIT', carrierId, trackingNumber: 'G-7' }).expect(400);
    });

    it('contra entrega: queda pagado una sola vez al entregarse', async () => {
      const { id } = await confirmedOrder(codId);
      await ship(id, { status: 'IN_TRANSIT', carrierId, trackingNumber: 'G-8' }).expect(200);
      const delivered = (await ship(id, { status: 'DELIVERED' }).expect(200)).body as AdminOrder;
      expect(delivered.paymentStatus).toBe('PAID');
      const paidAt = async () => (await prisma.order.findUniqueOrThrow({ where: { id } })).paidAt;
      const firstPaidAt = await paidAt();
      expect(firstPaidAt).toBeInstanceOf(Date);
      await ship(id, { status: 'DELIVERED', notes: 'Corrección' }).expect(200);
      expect(await prisma.paymentRecord.count({ where: { orderId: id, status: 'PAID' } })).toBe(1);
      // Corregir la entrega no cambia la fecha del pago.
      expect(await paidAt()).toEqual(firstPaidAt);
    });
  });

  describe('entrega local', () => {
    it('se despacha y entrega sin transportadora ni guía, y el cliente lo ve como entrega local', async () => {
      const { id, token } = await confirmedOrder();
      const shipped = (await ship(id, { method: 'LOCAL', status: 'IN_TRANSIT' }).expect(200))
        .body as AdminOrder & { shipping: { method: string } };
      expect(shipped).toMatchObject({
        status: 'SHIPPED',
        shipping: { method: 'LOCAL', status: 'IN_TRANSIT' },
      });

      const tracking = (await track(token)) as Tracking & { shipping: { method: string } };
      expect(tracking.shipping).toMatchObject({
        method: 'LOCAL',
        status: 'IN_TRANSIT',
        trackingNumber: null,
        trackingUrl: null,
      });

      await ship(id, { status: 'DELIVERED' }).expect(200);
      const history = await prisma.orderStatusHistory.findMany({
        where: { orderId: id, type: 'SHIPPING' },
        orderBy: { createdAt: 'asc' },
      });
      expect(history[0].note).toBe('Pedido en camino (entrega local).');
    });

    it('la entrega local descarta transportadora y guía', async () => {
      const { id } = await confirmedOrder();
      await ship(id, { status: 'NOT_SHIPPED', carrierId, trackingNumber: 'G-L' }).expect(200);
      const local = (await ship(id, { method: 'LOCAL', status: 'IN_TRANSIT' }).expect(200))
        .body as AdminOrder;
      expect(local.shipping).toMatchObject({ trackingNumber: null });
      const row = await prisma.shipping.findUniqueOrThrow({ where: { orderId: id } });
      expect(row).toMatchObject({ method: 'LOCAL', carrierId: null, trackingNumber: null });
    });

    it('por transportadora sigue exigiendo transportadora y guía', async () => {
      const { id } = await confirmedOrder();
      await ship(id, { method: 'CARRIER', status: 'IN_TRANSIT' }).expect(400);
      await ship(id, {
        method: 'CARRIER',
        status: 'IN_TRANSIT',
        carrierId,
        trackingNumber: 'G-C',
      }).expect(200);
    });
  });

  describe('coherencia con el estado del pedido', () => {
    it('desde el estado del pedido no se despacha ni se entrega', async () => {
      const { id } = await confirmedOrder();
      await staff.patch(`${ORDERS}/${id}/status`).send({ status: 'SHIPPED' }).expect(400);
      await staff.patch(`${ORDERS}/${id}/status`).send({ status: 'DELIVERED' }).expect(400);
    });

    it('despachar y cancelar a la vez deja un estado coherente', async () => {
      const { id } = await confirmedOrder();
      await Promise.all([
        ship(id, { status: 'IN_TRANSIT', carrierId, trackingNumber: 'G-9' }),
        owner.patch(`${ORDERS}/${id}/cancel`).send({ reason: 'Cancelación simultánea' }),
      ]);
      const order = await prisma.order.findUniqueOrThrow({
        where: { id },
        include: { shipping: true },
      });
      if (order.status === 'CANCELLED') {
        expect(order.shipping?.status ?? 'NOT_SHIPPED').toBe('NOT_SHIPPED');
      } else {
        expect(order.status).toBe('SHIPPED');
      }
    });
  });
});
