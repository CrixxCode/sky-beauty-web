import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import { NoticesService } from '../src/modules/notices/notices.service';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const HOUR = 60 * 60 * 1000;
const ORDERS = '/api/v1/admin/orders';
const NOTICES = '/api/v1/admin/notices';
const NOTIFICATIONS = '/api/v1/admin/notifications';

type Agent = Awaited<ReturnType<typeof loginAgent>>;
type Notice = {
  id: string;
  orderCode: string;
  case: string;
  stage: string;
  status: string;
  message: string;
  whatsappUrl: string;
  sentByName: string | null;
};
type Notifications = {
  unread: number;
  items: Array<{ id: string; type: string; title: string; read: boolean }>;
};

const at = (base: Date, hours: number) => new Date(base.getTime() + hours * HOUR);

describe('Cancelaciones automáticas y avisos (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let notices: NoticesService;
  let owner: Agent;
  let staff: Agent;
  let variantId: string;
  let transferId: string;
  let codId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    notices = app.get(NoticesService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test', name: 'Dueña' });
    await createAdminUser(prisma, {
      email: 'personal@ejemplo.test',
      name: 'Personal',
      role: AdminRole.STAFF,
    });
    owner = await loginAgent(app, 'duena@ejemplo.test');
    staff = await loginAgent(app, 'personal@ejemplo.test');

    const brand = await prisma.brand.create({
      data: { name: 'Marca Avisos', slug: 'marca-avisos' },
    });
    const category = await prisma.category.create({
      data: { name: 'Categoría Avisos', slug: 'categoria-avisos' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Producto Avisos',
        slug: 'producto-avisos',
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
        data: { productId: product.id, sku: 'AVI-1', name: 'Tono avisos', stock: 10 },
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
  });

  afterAll(() => app.close());

  async function createOrder(paymentMethodId = transferId) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/store/orders')
      .send({
        items: [{ variantId, quantity: 2 }],
        municipalityCode: '44001',
        customerName: 'Ana Ficticia',
        customerPhone: '3001112233',
        addressLine: 'Dirección ficticia 123',
        paymentMethodId,
        idempotencyKey: `aviso-${Date.now()}-${Math.random()}`,
        termsAccepted: true,
        dataProcessingAccepted: true,
      })
      .expect(201);
    const { id, code, publicToken } = res.body as { id: string; code: string; publicToken: string };
    const { createdAt } = await prisma.order.findUniqueOrThrow({ where: { id } });
    return { id, code, token: publicToken, createdAt };
  }

  const stockOf = async () =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock;
  const noticesOf = (orderId: string) =>
    prisma.cancellationNotice.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
  const tracking = async (token: string) =>
    (await request(app.getHttpServer()).get(`/api/v1/store/orders/tracking/${token}`).expect(200))
      .body as { status: string; notice: { stage: string; text: string } | null };

  describe('pedido sin confirmar (48 horas)', () => {
    it('avisa 1 hora antes, cancela al vencer, libera existencias y avisa la cancelación', async () => {
      const order = await createOrder();
      expect(await stockOf()).toBe(8);

      // Antes de la última hora no pasa nada.
      expect(await notices.runCycle(at(order.createdAt, 46.9))).toMatchObject({ beforeCreated: 0 });

      // Última hora: aviso "antes", una sola vez.
      expect(await notices.runCycle(at(order.createdAt, 47.5))).toMatchObject({ beforeCreated: 1 });
      expect(await notices.runCycle(at(order.createdAt, 47.6))).toMatchObject({ beforeCreated: 0 });
      const [before] = await noticesOf(order.id);
      expect(before).toMatchObject({ case: 'UNCONFIRMED', stage: 'BEFORE', status: 'PENDING' });
      expect(before.message).toBe(
        `Hola, Ana Ficticia. Tu pedido ${order.code} se cancelará en 1 hora. Motivo: no hemos recibido la confirmación de tu pedido por WhatsApp. Si aún lo quieres, escríbenos por este chat.`,
      );

      // El seguimiento lo muestra sin el nombre y con la fecha exacta.
      const pendingView = await tracking(order.token);
      expect(pendingView.notice?.stage).toBe('BEFORE');
      expect(pendingView.notice?.text).toMatch(
        new RegExp(`^Tu pedido ${order.code} se cancelará el .+\\. Motivo: no hemos recibido`),
      );
      expect(pendingView.notice?.text).not.toContain('Ana');

      // Vence: se cancela solo.
      expect(await notices.runCycle(at(order.createdAt, 48.01))).toMatchObject({ cancelled: 1 });
      const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelReason).toBe(
        'Cancelación automática: el pedido siguió sin confirmar 48 horas después de creado.',
      );
      expect(await stockOf()).toBe(10);

      const all = await noticesOf(order.id);
      expect(all.map((n) => [n.stage, n.status])).toEqual([
        ['BEFORE', 'EXPIRED'], // nadie lo envió a tiempo
        ['AFTER', 'PENDING'],
      ]);
      const afterView = await tracking(order.token);
      expect(afterView.notice).toMatchObject({ stage: 'AFTER' });
      expect(afterView.notice?.text).toBe(
        `Tu pedido ${order.code} fue cancelado. Motivo: no recibimos la confirmación de tu pedido por WhatsApp. Si aún quieres los productos, puedes hacer un nuevo pedido en la tienda.`,
      );

      // No se cancela dos veces.
      expect(await notices.runCycle(at(order.createdAt, 49))).toMatchObject({ cancelled: 0 });
    });

    it('si la tienda confirma a tiempo, el aviso se descarta y no se cancela', async () => {
      const order = await createOrder();
      await notices.runCycle(at(order.createdAt, 47.5));
      await staff.patch(`${ORDERS}/${order.id}/confirm`).send({ shippingCost: 5000 }).expect(200);

      const [before] = await noticesOf(order.id);
      expect(before.status).toBe('DISCARDED');
      expect((await tracking(order.token)).notice).toBeNull();
      // Con el comprobante recibido tampoco aplica el plazo de 24 horas sin comprobante.
      await staff.patch(`${ORDERS}/${order.id}/payment-received`).send({}).expect(200);
      expect(await notices.runCycle(at(order.createdAt, 48.5))).toMatchObject({ cancelled: 0 });
    });
  });

  describe('pedido confirmado sin comprobante (24 horas)', () => {
    it('avisa y cancela si no llega el comprobante', async () => {
      const order = await createOrder();
      await staff.patch(`${ORDERS}/${order.id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      const { confirmedAt } = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      if (!confirmedAt) throw new Error('Sin fecha de confirmación');

      expect(await notices.runCycle(at(confirmedAt, 23.5))).toMatchObject({ beforeCreated: 1 });
      expect(await notices.runCycle(at(confirmedAt, 24.01))).toMatchObject({ cancelled: 1 });
      const cancelled = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(cancelled.cancelReason).toBe(
        'Cancelación automática: no se recibió el comprobante de pago 24 horas después de confirmado.',
      );
      const [, after] = await noticesOf(order.id);
      expect(after).toMatchObject({ case: 'NO_PAYMENT_PROOF', stage: 'AFTER' });
    });

    it('con el comprobante recibido no se cancela por plazo', async () => {
      const order = await createOrder();
      await staff.patch(`${ORDERS}/${order.id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      const { confirmedAt } = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      if (!confirmedAt) throw new Error('Sin fecha de confirmación');

      await notices.runCycle(at(confirmedAt, 23.5));
      await staff.patch(`${ORDERS}/${order.id}/payment-received`).send({}).expect(200);
      expect((await noticesOf(order.id))[0].status).toBe('DISCARDED');
      expect(await notices.runCycle(at(confirmedAt, 30))).toMatchObject({ cancelled: 0 });
    });

    it('el contra entrega no se cancela por falta de comprobante', async () => {
      const order = await createOrder(codId);
      await staff.patch(`${ORDERS}/${order.id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      const { confirmedAt } = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      if (!confirmedAt) throw new Error('Sin fecha de confirmación');
      expect(await notices.runCycle(at(confirmedAt, 30))).toEqual({
        beforeCreated: 0,
        cancelled: 0,
        closed: 0,
      });
    });
  });

  describe('pago no demostrado (8 horas)', () => {
    it('avisa 1 hora antes, no cancela solo y avisa cuando una persona cancela', async () => {
      const order = await createOrder();
      await staff.patch(`${ORDERS}/${order.id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await staff.patch(`${ORDERS}/${order.id}/payment-received`).send({}).expect(200);
      await owner
        .patch(`${ORDERS}/${order.id}/payment/reject`)
        .send({ reason: 'Sin evidencia del pago' })
        .expect(200);
      const { paymentRejectedAt } = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      if (!paymentRejectedAt) throw new Error('Sin fecha de rechazo');

      expect(await notices.runCycle(at(paymentRejectedAt, 7.5))).toMatchObject({
        beforeCreated: 1,
      });
      // Vencido el plazo: no se cancela solo; el aviso "antes" sin enviar vence.
      expect(await notices.runCycle(at(paymentRejectedAt, 9))).toMatchObject({
        cancelled: 0,
        closed: 1,
      });
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
        'CONFIRMED',
      );
      expect((await noticesOf(order.id))[0].status).toBe('EXPIRED');

      // Una persona cancela tras el plazo: aviso de cancelación del caso.
      await prisma.order.update({
        where: { id: order.id },
        data: { paymentRejectedAt: new Date(Date.now() - 9 * HOUR) },
      });
      await staff
        .patch(`${ORDERS}/${order.id}/cancel`)
        .send({ reason: 'Pago no demostrado' })
        .expect(200);
      const after = (await noticesOf(order.id)).find((n) => n.stage === 'AFTER');
      expect(after).toMatchObject({ case: 'PAYMENT_NOT_PROVEN', status: 'PENDING' });
    });
  });

  it('ciclos simultáneos no duplican avisos ni cancelaciones', async () => {
    const order = await createOrder();
    await Promise.all([1, 2, 3].map(() => notices.runCycle(at(order.createdAt, 47.5))));
    expect(await noticesOf(order.id)).toHaveLength(1);
    await Promise.all([1, 2, 3].map(() => notices.runCycle(at(order.createdAt, 48.5))));
    expect(await stockOf()).toBe(10);
    expect(
      await prisma.inventoryMovement.count({
        where: { orderId: order.id, type: 'ORDER_RELEASED' },
      }),
    ).toBe(1);
    expect(await noticesOf(order.id)).toHaveLength(2);
  });

  describe('bandeja de avisos', () => {
    it('lista los pendientes con el enlace de WhatsApp al cliente y se marcan como enviados', async () => {
      const order = await createOrder();
      await notices.runCycle(at(order.createdAt, 47.5));

      const count = (await staff.get(`${NOTICES}/pending-count`).expect(200)).body as {
        pending: number;
      };
      expect(count.pending).toBe(1);
      const [notice] = (await staff.get(NOTICES).expect(200)).body as Notice[];
      expect(notice).toMatchObject({ orderCode: order.code, stage: 'BEFORE', status: 'PENDING' });
      expect(notice.whatsappUrl).toBe(
        `https://wa.me/573001112233?text=${encodeURIComponent(notice.message)}`,
      );

      await staff.patch(`${NOTICES}/${notice.id}/sent`).expect(204);
      await staff.patch(`${NOTICES}/${notice.id}/sent`).expect(409);
      const [sent] = (await staff.get(`${NOTICES}?status=SENT`).expect(200)).body as Notice[];
      expect(sent).toMatchObject({ id: notice.id, status: 'SENT', sentByName: 'Personal' });

      // Un aviso enviado sigue visible para el cliente mientras aplique.
      expect((await tracking(order.token)).notice?.stage).toBe('BEFORE');
      await request(app.getHttpServer()).get(NOTICES).expect(401);
    });
  });

  describe('notificaciones del panel', () => {
    it('notifica avisos y cancelaciones, con lectura independiente para cada usuario', async () => {
      const order = await createOrder();
      await notices.runCycle(at(order.createdAt, 47.5));
      await notices.runCycle(at(order.createdAt, 48.5));

      const forStaff = (await staff.get(NOTIFICATIONS).expect(200)).body as Notifications;
      expect(forStaff.unread).toBe(3);
      expect(forStaff.items.map((n) => n.type).sort()).toEqual([
        'NOTICE_PENDING',
        'NOTICE_PENDING',
        'ORDER_AUTO_CANCELLED',
      ]);
      expect(forStaff.items.map((n) => n.title)).toContain(
        `Pedido ${order.code} cancelado automáticamente`,
      );

      await staff.patch(`${NOTIFICATIONS}/${forStaff.items[0].id}/read`).expect(204);
      expect(((await staff.get(NOTIFICATIONS).expect(200)).body as Notifications).unread).toBe(2);
      // La propietaria sigue viéndolas sin leer.
      expect(((await owner.get(NOTIFICATIONS).expect(200)).body as Notifications).unread).toBe(3);

      await staff.patch(`${NOTIFICATIONS}/read-all`).expect(204);
      const after = (await staff.get(NOTIFICATIONS).expect(200)).body as Notifications;
      expect(after.unread).toBe(0);
      expect(after.items.every((n) => n.read)).toBe(true);
    });
  });
});
