import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const ORDERS = '/api/v1/admin/orders';
const HOUR = 60 * 60 * 1000;

type Agent = Awaited<ReturnType<typeof loginAgent>>;
type AdminOrder = {
  paymentStatus: string;
  paymentRejectedAt: string | null;
  paymentClarificationDeadline: string | null;
  staffCanCancel: boolean;
};

describe('Pagos (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let owner: Agent;
  let staff: Agent;
  let variantId: string;
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

    const brand = await prisma.brand.create({ data: { name: 'Marca Pagos', slug: 'marca-pagos' } });
    const category = await prisma.category.create({
      data: { name: 'Categoría Pagos', slug: 'categoria-pagos' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Producto Pagos',
        slug: 'producto-pagos',
        description: 'Producto ficticio.',
        brandId: brand.id,
        categoryId: category.id,
        basePrice: 10000,
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });
    const variant = await prisma.productVariant.create({
      data: { productId: product.id, sku: 'PAG-1', name: 'Tono pagos', stock: 10 },
    });
    variantId = variant.id;
    await prisma.inventoryMovement.create({
      data: {
        variantId,
        type: 'INITIAL',
        quantity: 10,
        stockBefore: 0,
        stockAfter: 10,
        reason: '',
      },
    });
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

  /** Pedido confirmado de 2 × 10.000 + 5.000 de envío = 25.000. */
  async function confirmedOrder(paymentMethodId = transferId): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/store/orders')
      .send({
        items: [{ variantId, quantity: 2 }],
        municipalityCode: '44001',
        customerName: 'Cliente Ficticio',
        customerPhone: '3001112233',
        addressLine: 'Dirección ficticia 123',
        paymentMethodId,
        idempotencyKey: `pago-${Date.now()}-${Math.random()}`,
        termsAccepted: true,
        dataProcessingAccepted: true,
      })
      .expect(201);
    const id = (res.body as { id: string }).id;
    await owner.patch(`${ORDERS}/${id}/confirm`).send({ shippingCost: 5000 }).expect(200);
    return id;
  }

  const paymentOf = async (id: string) =>
    (await prisma.order.findUniqueOrThrow({ where: { id } })).paymentStatus;

  it('el personal registra el comprobante; solo la propietaria verifica', async () => {
    const id = await confirmedOrder();
    const received = (
      await staff
        .patch(`${ORDERS}/${id}/payment-received`)
        .send({ reference: 'REF-FICTICIA-1' })
        .expect(200)
    ).body as AdminOrder;
    expect(received.paymentStatus).toBe('AWAITING_VERIFICATION');

    await staff.patch(`${ORDERS}/${id}/payment/verify`).send({}).expect(403);
    await staff.patch(`${ORDERS}/${id}/payment/reject`).send({ reason: 'No' }).expect(403);

    const beforeVerify = Date.now();
    await owner.patch(`${ORDERS}/${id}/payment/verify`).send({}).expect(200);
    expect(await paymentOf(id)).toBe('PAID');
    // La fecha de verificación ubica la venta en los reportes.
    const { paidAt } = await prisma.order.findUniqueOrThrow({ where: { id } });
    expect(paidAt?.getTime()).toBeGreaterThanOrEqual(beforeVerify - 1000);

    const records = await prisma.paymentRecord.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
      include: { recordedBy: true },
    });
    expect(records.map((r) => [r.status, r.amount.toNumber(), r.recordedBy?.email])).toEqual([
      ['AWAITING_VERIFICATION', 25000, 'personal@ejemplo.test'],
      ['PAID', 25000, 'duena@ejemplo.test'],
    ]);
    expect(records[0].reference).toBe('REF-FICTICIA-1');
  });

  it('el contra entrega no registra comprobante: se paga al entregarse', async () => {
    const id = await confirmedOrder(codId);
    await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(400);
    await owner.patch(`${ORDERS}/${id}/payment/verify`).send({}).expect(400);
  });

  it('BE-170: un pago menor se rechaza como incompleto y abre 8 horas de aclaración', async () => {
    const id = await confirmedOrder();
    await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(200);
    const res = await owner
      .patch(`${ORDERS}/${id}/payment/verify`)
      .send({ amount: 24000 })
      .expect(200);
    const result = res.body as AdminOrder;
    expect(result.paymentStatus).toBe('REJECTED');
    expect(
      new Date(result.paymentClarificationDeadline!).getTime() -
        new Date(result.paymentRejectedAt!).getTime(),
    ).toBe(8 * HOUR);
    expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toMatchObject({ paidAt: null });
    const record = await prisma.paymentRecord.findFirstOrThrow({
      where: { orderId: id, status: 'REJECTED' },
    });
    expect(record.amount.toNumber()).toBe(24000);
    expect(record.note).toContain('Pago incompleto');
    await staff.patch(`${ORDERS}/${id}/cancel`).send({ reason: 'Pago incompleto' }).expect(403);
    await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(200);
    await owner.patch(`${ORDERS}/${id}/payment/verify`).send({ amount: 25000 }).expect(200);
    expect(await paymentOf(id)).toBe('PAID');
  });

  it('BE-170: un pago mayor exige soporte y registra el excedente sin inflar lo pagado del pedido', async () => {
    const id = await confirmedOrder();
    await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(200);
    await owner.patch(`${ORDERS}/${id}/payment/verify`).send({ amount: 26000 }).expect(400);
    await owner
      .patch(`${ORDERS}/${id}/payment/verify`)
      .send({ amount: 26000, note: '   ' })
      .expect(400);
    expect(await paymentOf(id)).toBe('AWAITING_VERIFICATION');
    await owner
      .patch(`${ORDERS}/${id}/payment/verify`)
      .send({ amount: 26000, note: 'Excedente pendiente de devolver por transferencia.' })
      .expect(200);
    const record = await prisma.paymentRecord.findFirstOrThrow({
      where: { orderId: id, status: 'PAID' },
    });
    expect(record.amount.toNumber()).toBe(25000);
    expect(record.note).toContain('Excedente por devolver');
    expect(record.note).toContain('1.000');
  });

  it('BE-149: bloquea aumentos del envío pagado sin alterar el total ni su historial', async () => {
    const id = await confirmedOrder();
    await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(200);
    await owner.patch(`${ORDERS}/${id}/payment/verify`).send({}).expect(200);
    const events = await prisma.orderStatusHistory.count({ where: { orderId: id } });
    await staff.patch(`${ORDERS}/${id}/shipping-cost`).send({ shippingCost: 6000 }).expect(400);
    expect(await prisma.orderStatusHistory.count({ where: { orderId: id } })).toBe(events);
    expect((await prisma.order.findUniqueOrThrow({ where: { id } })).total.toNumber()).toBe(25000);
    await staff.patch(`${ORDERS}/${id}/shipping-cost`).send({ shippingCost: 5000 }).expect(200);
    await staff.patch(`${ORDERS}/${id}/shipping-cost`).send({ shippingCost: 4000 }).expect(200);
    // Una reducción no cambia lo efectivamente pagado: la devolución total conserva 25.000.
    await owner
      .patch(`${ORDERS}/${id}/payment/refund`)
      .send({ amount: 24000, note: 'Parcial no permitida' })
      .expect(400);
    await owner
      .patch(`${ORDERS}/${id}/payment/refund`)
      .send({ amount: 25000, note: 'Devolución total' })
      .expect(200);
  });

  it('no registra comprobantes en pedidos cancelados', async () => {
    const id = await confirmedOrder();
    await owner
      .patch(`${ORDERS}/${id}/cancel`)
      .send({ reason: 'Prueba de cancelación' })
      .expect(200);
    await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(400);
  });

  it('un pedido con el pago verificado se cancela solo después de registrar la devolución', async () => {
    const id = await confirmedOrder();
    await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(200);
    await owner.patch(`${ORDERS}/${id}/payment/verify`).send({}).expect(200);

    const rejected = await owner
      .patch(`${ORDERS}/${id}/cancel`)
      .send({ reason: 'La clienta desistió' })
      .expect(400);
    expect((rejected.body as { message: string }).message).toBe(
      'Este pedido tiene el pago verificado. Registra primero la devolución del dinero y después cancélalo.',
    );
    expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    });

    await owner
      .patch(`${ORDERS}/${id}/payment/refund`)
      .send({ amount: 25000, note: 'Devolución total por desistimiento' })
      .expect(200);
    await owner.patch(`${ORDERS}/${id}/cancel`).send({ reason: 'La clienta desistió' }).expect(200);
    expect(await prisma.order.findUniqueOrThrow({ where: { id } })).toMatchObject({
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
    });
  });

  describe('pago rechazado y plazo de aclaración', () => {
    it('al rechazar empieza el plazo; el personal cancela solo cuando vence', async () => {
      const id = await confirmedOrder();
      await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(200);
      await owner.patch(`${ORDERS}/${id}/payment/reject`).send({ reason: '   ' }).expect(400);
      const rejected = (
        await owner
          .patch(`${ORDERS}/${id}/payment/reject`)
          .send({ reason: 'No se ve el pago en la cuenta' })
          .expect(200)
      ).body as AdminOrder;

      expect(rejected.paymentStatus).toBe('REJECTED');
      const rejectedAt = new Date(rejected.paymentRejectedAt ?? '').getTime();
      expect(new Date(rejected.paymentClarificationDeadline ?? '').getTime() - rejectedAt).toBe(
        8 * HOUR,
      );
      expect(rejected.staffCanCancel).toBe(false);
      await staff
        .patch(`${ORDERS}/${id}/cancel`)
        .send({ reason: 'Pago no demostrado' })
        .expect(403);

      // Vence el plazo.
      await prisma.order.update({
        where: { id },
        data: { paymentRejectedAt: new Date(Date.now() - 9 * HOUR) },
      });
      const expired = (await staff.get(`${ORDERS}/${id}`).expect(200)).body as AdminOrder;
      expect(expired.staffCanCancel).toBe(true);
      await staff
        .patch(`${ORDERS}/${id}/cancel`)
        .send({ reason: 'Pago no demostrado' })
        .expect(200);
      expect(
        (await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock,
      ).toBe(10);
    });

    it('si el cliente aclara con un nuevo comprobante, vuelve a quedar por verificar', async () => {
      const id = await confirmedOrder();
      await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(200);
      await owner
        .patch(`${ORDERS}/${id}/payment/reject`)
        .send({ reason: 'Comprobante ilegible' })
        .expect(200);
      const again = (await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(200))
        .body as AdminOrder;
      expect(again).toMatchObject({
        paymentStatus: 'AWAITING_VERIFICATION',
        paymentRejectedAt: null,
        paymentClarificationDeadline: null,
        staffCanCancel: false,
      });
    });

    it('verificar y rechazar a la vez: solo se aplica una', async () => {
      const id = await confirmedOrder();
      await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(200);
      const results = await Promise.all([
        owner.patch(`${ORDERS}/${id}/payment/verify`).send({}),
        owner.patch(`${ORDERS}/${id}/payment/reject`).send({ reason: 'Rechazo simultáneo' }),
      ]);
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      const records = await prisma.paymentRecord.count({
        where: { orderId: id, status: { in: ['PAID', 'REJECTED'] } },
      });
      expect(records).toBe(1);
    });
  });

  describe('devoluciones', () => {
    async function paidOrder(): Promise<string> {
      const id = await confirmedOrder();
      await staff.patch(`${ORDERS}/${id}/payment-received`).send({}).expect(200);
      await owner.patch(`${ORDERS}/${id}/payment/verify`).send({}).expect(200);
      return id;
    }

    it('registra la devolución sin superar lo pagado y solo una vez', async () => {
      const id = await paidOrder();
      await staff
        .patch(`${ORDERS}/${id}/payment/refund`)
        .send({ amount: 25000, note: 'Devolución' })
        .expect(403);
      await owner
        .patch(`${ORDERS}/${id}/payment/refund`)
        .send({ amount: 25001, note: 'Devolución de prueba' })
        .expect(400);
      await owner
        .patch(`${ORDERS}/${id}/payment/refund`)
        .send({ amount: 1000, note: 'BE-172: parcial no permitida' })
        .expect(400);
      expect(await paymentOf(id)).toBe('PAID');
      await owner
        .patch(`${ORDERS}/${id}/payment/refund`)
        .send({ amount: 25000, note: '   ' })
        .expect(400);
      await owner
        .patch(`${ORDERS}/${id}/payment/refund`)
        .send({ amount: 25000, note: 'Devolución de prueba', reference: 'DEV-1' })
        .expect(200);
      expect(await paymentOf(id)).toBe('REFUNDED');
      await owner
        .patch(`${ORDERS}/${id}/payment/refund`)
        .send({ amount: 1000, note: 'Otra devolución' })
        .expect(400);
    });

    it('devoluciones simultáneas no se registran dos veces', async () => {
      const id = await paidOrder();
      const results = await Promise.all(
        [1, 2].map(() =>
          owner.patch(`${ORDERS}/${id}/payment/refund`).send({ amount: 25000, note: 'Doble clic' }),
        ),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(await prisma.paymentRecord.count({ where: { orderId: id, status: 'REFUNDED' } })).toBe(
        1,
      );
    });
  });
});
