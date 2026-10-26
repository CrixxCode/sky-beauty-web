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
  kind: string;
  type: string | null;
};
type Notifications = {
  unread: number;
  items: Array<{
    id: string;
    type: string;
    title: string;
    read: boolean;
    body: string;
    href: string;
  }>;
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

  async function createOrder(
    paymentMethodId = transferId,
    idempotencyKey = `aviso-${Date.now()}-${Math.random()}`,
  ) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/store/orders')
      .send({
        items: [{ variantId, quantity: 2 }],
        municipalityCode: '44001',
        customerName: 'Ana Ficticia',
        customerPhone: '3001112233',
        addressLine: 'Dirección ficticia 123',
        paymentMethodId,
        idempotencyKey,
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
      // La hora termina en "a. m." o "p. m.": sin un segundo punto.
      expect(pendingView.notice?.text).not.toContain('..');

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

    it('filtra los pendientes de un pedido, para enviarlos desde su detalle', async () => {
      const first = await createOrder();
      const second = await createOrder();
      await staff.patch(`${ORDERS}/${first.id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await staff.patch(`${ORDERS}/${second.id}/confirm`).send({ shippingCost: 5000 }).expect(200);

      const ofFirst = (await staff.get(`${NOTICES}?orderId=${first.id}`).expect(200))
        .body as Notice[];
      expect(ofFirst).toHaveLength(1);
      expect(ofFirst[0]).toMatchObject({ orderId: first.id, kind: 'ORDER_UPDATE' });
      expect(((await staff.get(NOTICES).expect(200)).body as Notice[]).length).toBe(2);
      await staff.get(`${NOTICES}?orderId=no-es-uuid`).expect(400);
    });
  });

  describe('notificaciones del panel', () => {
    it('notifica avisos y cancelaciones, con lectura independiente para cada usuario', async () => {
      const order = await createOrder();
      await notices.runCycle(at(order.createdAt, 47.5));
      await notices.runCycle(at(order.createdAt, 48.5));

      const forStaff = (await staff.get(NOTIFICATIONS).expect(200)).body as Notifications;
      expect(forStaff.unread).toBe(4);
      expect(forStaff.items.map((n) => n.type).sort()).toEqual([
        'NOTICE_PENDING',
        'NOTICE_PENDING',
        'ORDER_AUTO_CANCELLED',
        'ORDER_RECEIVED',
      ]);
      expect(forStaff.items.map((n) => n.title)).toContain(
        `Pedido ${order.code} cancelado automáticamente`,
      );

      await staff.patch(`${NOTIFICATIONS}/${forStaff.items[0].id}/read`).expect(204);
      expect(((await staff.get(NOTIFICATIONS).expect(200)).body as Notifications).unread).toBe(3);
      // La propietaria sigue viéndolas sin leer.
      expect(((await owner.get(NOTIFICATIONS).expect(200)).body as Notifications).unread).toBe(4);

      await staff.patch(`${NOTIFICATIONS}/read-all`).expect(204);
      const after = (await staff.get(NOTIFICATIONS).expect(200)).body as Notifications;
      expect(after.unread).toBe(0);
      expect(after.items.every((n) => n.read)).toBe(true);
    });
  });

  describe('notificaciones operativas y mensajes al cliente', () => {
    const notificationTypes = async (agent: Agent) =>
      ((await agent.get(NOTIFICATIONS).expect(200)).body as Notifications).items.map((n) => n.type);
    const adjustStock = (quantity: number) =>
      staff
        .post('/api/v1/admin/inventory/movements')
        .send({ variantId, type: 'ADJUSTMENT', quantity, reason: 'Ajuste ficticio de prueba' })
        .expect(201);

    it('un reintento del checkout conserva un solo pedido y una sola notificación', async () => {
      const first = await createOrder(transferId, 'pedido-operativo-idempotente');
      const replay = await createOrder(transferId, 'pedido-operativo-idempotente');
      expect(replay.id).toBe(first.id);
      expect(await stockOf()).toBe(8);
      expect(await notificationTypes(staff)).toEqual(['ORDER_RECEIVED']);
      const list = (await staff.get(NOTIFICATIONS).expect(200)).body as Notifications;
      expect(list.items[0].href).toBe(`/admin/pedidos?pedido=${first.id}`);
    });

    it('protege comprobantes y excedentes en listado, contador y acciones de lectura', async () => {
      const order = await createOrder();
      await staff.patch(`${ORDERS}/${order.id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await staff.patch(`${ORDERS}/${order.id}/payment-received`).send({}).expect(200);
      // Guardar de nuevo mientras ya está por verificar no genera otro aviso.
      await staff
        .patch(`${ORDERS}/${order.id}/payment-received`)
        .send({ reference: 'Soporte ficticio' })
        .expect(200);
      await owner
        .patch(`${ORDERS}/${order.id}/payment/verify`)
        .send({ amount: 26000, note: 'Excedente ficticio para devolver a mano' })
        .expect(200);
      const forOwner = (await owner.get(NOTIFICATIONS).expect(200)).body as Notifications;
      expect(forOwner.unread).toBe(3);
      expect(forOwner.items.map((n) => n.type).sort()).toEqual([
        'ORDER_RECEIVED',
        'PAYMENT_EXCESS',
        'PAYMENT_PROOF_RECEIVED',
      ]);
      expect(await notificationTypes(staff)).toEqual(['ORDER_RECEIVED']);
      const hidden = forOwner.items.filter((n) => n.type !== 'ORDER_RECEIVED');
      for (const notification of hidden) {
        await staff.patch(`${NOTIFICATIONS}/${notification.id}/read`).expect(404);
      }
      await staff.patch(`${NOTIFICATIONS}/read-all`).expect(204);
      expect(((await staff.get(NOTIFICATIONS).expect(200)).body as Notifications).unread).toBe(0);
      expect(((await owner.get(NOTIFICATIONS).expect(200)).body as Notifications).unread).toBe(3);
      const staffUser = await prisma.adminUser.findUniqueOrThrow({
        where: { email: 'personal@ejemplo.test' },
      });
      expect(
        await prisma.adminNotificationRead.count({
          where: { adminId: staffUser.id, notificationId: { in: hidden.map((n) => n.id) } },
        }),
      ).toBe(0);
      await request(app.getHttpServer()).get(NOTIFICATIONS).expect(401);
    });

    it('notifica el rechazo y el pago incompleto, sin preparar un mensaje de pago verificado', async () => {
      const order = await createOrder();
      await staff.patch(`${ORDERS}/${order.id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await staff.patch(`${ORDERS}/${order.id}/payment-received`).send({}).expect(200);
      await owner
        .patch(`${ORDERS}/${order.id}/payment/reject`)
        .send({ reason: 'Soporte ficticio no demostrado' })
        .expect(200);
      expect(await notificationTypes(staff)).toContain('PAYMENT_REJECTED');
      await staff.patch(`${ORDERS}/${order.id}/payment-received`).send({}).expect(200);
      await owner.patch(`${ORDERS}/${order.id}/payment/verify`).send({ amount: 1000 }).expect(200);
      expect(
        (await notificationTypes(staff)).filter((type) => type === 'PAYMENT_REJECTED'),
      ).toHaveLength(2);
      expect(
        (await notificationTypes(owner)).filter((type) => type === 'PAYMENT_PROOF_RECEIVED'),
      ).toHaveLength(2);
      expect(
        await prisma.orderUpdateNotice.count({
          where: { orderId: order.id, type: 'PAYMENT_VERIFIED' },
        }),
      ).toBe(0);
    });

    it('avisa al cruzar stock bajo, al agotarse y al cruzar de nuevo tras reponer', async () => {
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { lowStockThreshold: 8 },
      });
      const order = await createOrder(); // 10 -> 8: reserva en checkout.
      await staff
        .patch(`${ORDERS}/${order.id}/items`)
        .send({ items: [{ variantId, quantity: 3 }] })
        .expect(200);
      await adjustStock(-1); // 7 -> 6: sigue bajo, sin aviso adicional.
      expect((await notificationTypes(staff)).filter((t) => t === 'LOW_STOCK')).toHaveLength(1);
      await adjustStock(4); // 6 -> 10: repuesto.
      await staff
        .patch(`${ORDERS}/${order.id}/items`)
        .send({ items: [{ variantId, quantity: 5 }] })
        .expect(200);
      expect((await notificationTypes(staff)).filter((t) => t === 'LOW_STOCK')).toHaveLength(2);
      await adjustStock(-8); // 8 -> 0: solo agotado.
      expect((await notificationTypes(staff)).filter((t) => t === 'OUT_OF_STOCK')).toHaveLength(1);
      expect((await notificationTypes(staff)).filter((t) => t === 'LOW_STOCK')).toHaveLength(2);
      await staff
        .post('/api/v1/admin/inventory/movements')
        .send({ variantId, type: 'ADJUSTMENT', quantity: -1, reason: 'Salida imposible ficticia' })
        .expect(400);
      expect(await stockOf()).toBe(0);
      const list = (await staff.get(NOTIFICATIONS).expect(200)).body as Notifications;
      expect(
        list.items
          .filter((n) => ['LOW_STOCK', 'OUT_OF_STOCK'].includes(n.type))
          .every((n) => n.href === '/admin/inventario'),
      ).toBe(true);
    });

    it('notifica agotados sin umbral y revierte los avisos si la transacción falla', async () => {
      const order = await createOrder(); // 8 restantes, sin umbral.
      await adjustStock(-8);
      expect(await notificationTypes(staff)).toContain('OUT_OF_STOCK');
      await adjustStock(10);
      const before = await prisma.adminNotification.count();
      await staff
        .patch(`${ORDERS}/${order.id}/items`)
        .send({
          items: [
            { variantId, quantity: 12 },
            { variantId: '00000000-0000-4000-8000-000000000000', quantity: 1 },
          ],
        })
        .expect(400); // La reserva llega a cero, pero otra línea falla: rollback completo.
      expect(await stockOf()).toBe(10);
      expect(await prisma.adminNotification.count()).toBe(before);
    });

    it('movimientos simultáneos de una variante generan un solo aviso al cruzar el umbral', async () => {
      await prisma.productVariant.update({
        where: { id: variantId },
        data: { lowStockThreshold: 8 },
      });
      await Promise.all([adjustStock(-1), adjustStock(-1), adjustStock(-1)]);
      expect(await stockOf()).toBe(7);
      expect((await notificationTypes(staff)).filter((type) => type === 'LOW_STOCK')).toHaveLength(
        1,
      );
    });

    it('prepara confirmación, pago y despacho; registra el envío manual y cuenta todos los pendientes', async () => {
      const order = await createOrder();
      await staff.patch(`${ORDERS}/${order.id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await staff.patch(`${ORDERS}/${order.id}/payment-received`).send({}).expect(200);
      await owner.patch(`${ORDERS}/${order.id}/payment/verify`).send({}).expect(200);
      const carrier = await prisma.carrier.create({ data: { name: 'Transportadora ficticia' } });
      const shipping = {
        method: 'CARRIER',
        carrierId: carrier.id,
        trackingNumber: 'GUIA-FICTICIA',
        status: 'IN_TRANSIT',
      };
      await staff.patch(`${ORDERS}/${order.id}/shipping`).send(shipping).expect(200);
      await staff.patch(`${ORDERS}/${order.id}/shipping`).send(shipping).expect(200);
      await staff
        .patch(`${ORDERS}/${order.id}/shipping`)
        .send({ ...shipping, trackingNumber: 'GUIA-CORREGIDA-FICTICIA' })
        .expect(200);
      const pending = (await staff.get(NOTICES).expect(200)).body as Notice[];
      expect(pending.map((n) => n.type).sort()).toEqual([
        'ORDER_CONFIRMED',
        'ORDER_SHIPPED',
        'PAYMENT_VERIFIED',
      ]);
      expect(pending.every((n) => n.kind === 'ORDER_UPDATE' && n.status === 'PENDING')).toBe(true);
      const shipped = pending.find((n) => n.type === 'ORDER_SHIPPED')!;
      expect(shipped.message).toContain('Transportadora ficticia');
      expect(shipped.message).toContain('GUIA-CORREGIDA-FICTICIA');
      expect(shipped.message).toContain(`http://localhost:3000/seguimiento/${order.token}`);
      expect(shipped.whatsappUrl).toBe(
        `https://wa.me/573001112233?text=${encodeURIComponent(shipped.message)}`,
      );
      expect((await staff.get(`${NOTICES}/pending-count`).expect(200)).body).toEqual({
        pending: 3,
      });
      expect((await staff.get('/api/v1/admin/dashboard/pending').expect(200)).body).toMatchObject({
        noticesToSend: 3,
      });
      await staff.patch(`${NOTICES}/${shipped.id}/sent`).expect(204);
      await staff.patch(`${NOTICES}/${shipped.id}/sent`).expect(409);
      const sent = (await owner.get(`${NOTICES}?status=SENT`).expect(200)).body as Notice[];
      expect(sent[0]).toMatchObject({ id: shipped.id, sentByName: 'Personal' });
      await staff
        .patch(`${ORDERS}/${order.id}/shipping`)
        .send({ ...shipping, trackingNumber: 'OTRA-GUIA-FICTICIA' })
        .expect(200);
      expect(
        await prisma.orderUpdateNotice.findUnique({ where: { id: shipped.id } }),
      ).toMatchObject({ message: shipped.message, status: 'SENT' });
      expect((await staff.get(`${NOTICES}/pending-count`).expect(200)).body).toEqual({
        pending: 2,
      });
    });

    it('notifica novedades al entrar en ese estado y conserva un único mensaje de despacho local', async () => {
      const order = await createOrder(codId);
      await staff.patch(`${ORDERS}/${order.id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await staff
        .patch(`${ORDERS}/${order.id}/shipping`)
        .send({ method: 'LOCAL', status: 'IN_TRANSIT' })
        .expect(200);
      await staff.patch(`${ORDERS}/${order.id}/shipping`).send({ status: 'INCIDENT' }).expect(200);
      await staff
        .patch(`${ORDERS}/${order.id}/shipping`)
        .send({ status: 'INCIDENT', notes: 'Corrección ficticia' })
        .expect(200);
      expect(
        (await notificationTypes(staff)).filter((t) => t === 'SHIPPING_INCIDENT'),
      ).toHaveLength(1);
      await staff
        .patch(`${ORDERS}/${order.id}/shipping`)
        .send({ status: 'IN_TRANSIT' })
        .expect(200);
      await staff.patch(`${ORDERS}/${order.id}/shipping`).send({ status: 'INCIDENT' }).expect(200);
      expect(
        (await notificationTypes(staff)).filter((t) => t === 'SHIPPING_INCIDENT'),
      ).toHaveLength(2);
      const updates = await prisma.orderUpdateNotice.findMany({
        where: { orderId: order.id, type: 'ORDER_SHIPPED' },
      });
      expect(updates).toHaveLength(1);
      expect(updates[0].message).toContain('Entrega local de la tienda.');
      expect(updates[0].message).not.toContain('Guía:');
      await staff.patch(`${ORDERS}/${order.id}/shipping`).send({ status: 'DELIVERED' }).expect(200);
      expect(
        await prisma.orderUpdateNotice.count({
          where: { orderId: order.id, type: 'PAYMENT_VERIFIED' },
        }),
      ).toBe(1);
    });

    it('descarta mensajes pendientes que ya no aplican después de devolver y cancelar', async () => {
      const order = await createOrder();
      await staff.patch(`${ORDERS}/${order.id}/confirm`).send({ shippingCost: 5000 }).expect(200);
      await staff.patch(`${ORDERS}/${order.id}/payment-received`).send({}).expect(200);
      await owner.patch(`${ORDERS}/${order.id}/payment/verify`).send({}).expect(200);
      await owner
        .patch(`${ORDERS}/${order.id}/payment/refund`)
        .send({ amount: 25000, note: 'Devolución ficticia total' })
        .expect(200);
      expect(
        await prisma.orderUpdateNotice.findFirst({
          where: { orderId: order.id, type: 'PAYMENT_VERIFIED' },
        }),
      ).toMatchObject({ status: 'DISCARDED' });
      await owner
        .patch(`${ORDERS}/${order.id}/cancel`)
        .send({ reason: 'Cancelación ficticia posterior a devolución' })
        .expect(200);
      expect((await staff.get(NOTICES).expect(200)).body).toEqual([]);
    });
  });
});
