import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole, OrderStatus, PaymentStatus } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const REPORTS = '/api/v1/admin/reports';

type Agent = Awaited<ReturnType<typeof loginAgent>>;
type Sales = {
  summary: Record<string, number>;
  series: Array<{ period: string; orders: number; productsRevenue: number; total: number }>;
};
type Margins = Record<string, unknown> & { byProduct: unknown[] };
const sales = (res: request.Response) => res.body as Sales;
const margins = (res: request.Response) => res.body as Margins;

describe('Reportes (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let owner: Agent;
  let sequence = 0;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    sequence = 0;
    await resetDatabase(prisma);
    await seed(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
    await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
    owner = await loginAgent(app, 'duena@ejemplo.test');
  });

  afterAll(() => app.close());

  /** Pedido ficticio con fecha y estados controlados. */
  async function order(input: {
    createdAt: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    shippingCost?: number | null;
    carrierCost?: number;
    items: Array<{
      sku: string;
      qty: number;
      price: number;
      discount?: number;
      cost?: number | null;
    }>;
  }) {
    sequence += 1;
    const method = await prisma.paymentMethod.findUniqueOrThrow({
      where: { code: 'BANK_TRANSFER' },
    });
    const customer = await prisma.customer.upsert({
      where: { phone: '573001112233' },
      create: { fullName: 'Cliente Reporte', phone: '573001112233' },
      update: {},
    });
    const subtotal = input.items.reduce((s, i) => s + i.price * i.qty, 0);
    const discountTotal = input.items.reduce((s, i) => s + (i.discount ?? 0) * i.qty, 0);
    const shippingCost = input.shippingCost === undefined ? 5000 : input.shippingCost;
    const created = await prisma.order.create({
      data: {
        code: `SB-REP-${String(sequence).padStart(4, '0')}`,
        publicTokenHash: `hash-${sequence}`,
        idempotencyKey: `reporte-${sequence}`,
        requestHash: 'hash',
        customerId: customer.id,
        status: input.status ?? OrderStatus.DELIVERED,
        paymentStatus: input.paymentStatus ?? PaymentStatus.PAID,
        customerName: 'Cliente Reporte',
        customerPhone: '573001112233',
        municipalityCode: '44001',
        department: 'La Guajira',
        city: 'Riohacha',
        addressLine: 'Dirección ficticia',
        paymentMethodId: method.id,
        paymentMethodCode: method.code,
        paymentMethodName: method.name,
        subtotal,
        discountTotal,
        shippingCost,
        total: subtotal - discountTotal + (shippingCost ?? 0),
        termsAcceptedAt: new Date(),
        dataProcessingConsentAt: new Date(),
        cancelReason: input.status === OrderStatus.CANCELLED ? 'Prueba' : null,
        cancelledAt: input.status === OrderStatus.CANCELLED ? new Date() : null,
        confirmedAt: new Date(),
        createdAt: new Date(input.createdAt),
        items: {
          create: input.items.map((i) => ({
            productId: '00000000-0000-4000-8000-000000000000',
            productName: `Producto ${i.sku}`,
            productSlug: `producto-${i.sku.toLowerCase()}`,
            variantName: `Variante ${i.sku}`,
            sku: i.sku,
            unitListPrice: i.price,
            unitDiscount: i.discount ?? 0,
            unitFinalPrice: i.price - (i.discount ?? 0),
            unitCost: i.cost === undefined ? null : i.cost,
            quantity: i.qty,
            lineTotal: (i.price - (i.discount ?? 0)) * i.qty,
          })),
        },
        ...(input.carrierCost !== undefined && {
          shipping: { create: { status: 'DELIVERED', carrierCost: input.carrierCost } },
        }),
      },
    });
    return created.id;
  }

  it('solo la propietaria ve los reportes', async () => {
    const staff = await loginAgent(app, 'personal@ejemplo.test');
    const q = '?from=2026-10-01&to=2026-10-31';
    for (const path of ['sales', 'top-products', 'margins']) {
      await staff.get(`${REPORTS}/${path}${q}`).expect(403);
      await request(app.getHttpServer()).get(`${REPORTS}/${path}${q}`).expect(401);
    }
  });

  it('valida el rango de fechas', async () => {
    await owner.get(`${REPORTS}/sales?from=2026-10-31&to=2026-10-01`).expect(400);
    await owner.get(`${REPORTS}/sales?from=01-10-2026&to=2026-10-31`).expect(400);
    await owner.get(`${REPORTS}/sales?from=2020-01-01&to=2026-10-31`).expect(400);
    await owner.get(`${REPORTS}/sales?from=2026-10-01&to=2026-10-31&groupBy=year`).expect(400);
  });

  it('cuenta solo los pedidos con pago verificado, sin cancelados ni devueltos', async () => {
    const item = [{ sku: 'A', qty: 1, price: 10000 }];
    await order({ createdAt: '2026-10-10T15:00:00Z', items: item });
    await order({ createdAt: '2026-10-10T16:00:00Z', paymentStatus: 'PENDING', items: item });
    await order({
      createdAt: '2026-10-10T17:00:00Z',
      paymentStatus: 'AWAITING_VERIFICATION',
      items: item,
    });
    await order({ createdAt: '2026-10-10T18:00:00Z', paymentStatus: 'REFUNDED', items: item });
    await order({
      createdAt: '2026-10-10T19:00:00Z',
      status: 'CANCELLED',
      paymentStatus: 'PAID',
      items: item,
    });

    const res = await owner.get(`${REPORTS}/sales?from=2026-10-10&to=2026-10-10`).expect(200);
    expect(sales(res).summary).toEqual({
      orders: 1,
      productsRevenue: 10000,
      discounts: 0,
      shippingCharged: 5000,
      total: 15000,
      averageTicket: 15000,
    });
  });

  it('usa los días en hora de Colombia, con los dos extremos incluidos', async () => {
    const item = [{ sku: 'A', qty: 1, price: 10000 }];
    await order({ createdAt: '2026-10-01T04:59:00Z', items: item }); // 30 sep 23:59 en Colombia
    await order({ createdAt: '2026-10-01T05:00:00Z', items: item }); // 1 oct 00:00
    await order({ createdAt: '2026-11-01T04:59:00Z', items: item }); // 31 oct 23:59
    await order({ createdAt: '2026-11-01T05:00:00Z', items: item }); // 1 nov 00:00

    const res = await owner.get(`${REPORTS}/sales?from=2026-10-01&to=2026-10-31`).expect(200);
    expect(sales(res).summary.orders).toBe(2);
  });

  it('agrupa por día, semana o mes e incluye los períodos sin ventas', async () => {
    const item = [{ sku: 'A', qty: 2, price: 10000, discount: 1000 }];
    await order({ createdAt: '2026-10-05T15:00:00Z', items: item });
    await order({ createdAt: '2026-10-05T20:00:00Z', items: item, shippingCost: 0 });
    await order({ createdAt: '2026-10-07T15:00:00Z', items: item });

    const byDay = await owner
      .get(`${REPORTS}/sales?from=2026-10-05&to=2026-10-07&groupBy=day`)
      .expect(200);
    expect(sales(byDay).series).toEqual([
      { period: '2026-10-05', orders: 2, productsRevenue: 36000, total: 41000 },
      { period: '2026-10-06', orders: 0, productsRevenue: 0, total: 0 },
      { period: '2026-10-07', orders: 1, productsRevenue: 18000, total: 23000 },
    ]);
    expect(sales(byDay).summary).toMatchObject({ discounts: 6000, averageTicket: 21333.33 });

    const byMonth = await owner
      .get(`${REPORTS}/sales?from=2026-09-15&to=2026-10-31&groupBy=month`)
      .expect(200);
    expect(sales(byMonth).series.map((p) => [p.period, p.orders])).toEqual([
      ['2026-09-01', 0],
      ['2026-10-01', 3],
    ]);

    const byWeek = await owner
      .get(`${REPORTS}/sales?from=2026-10-05&to=2026-10-18&groupBy=week`)
      .expect(200);
    expect(sales(byWeek).series.map((p) => p.period)).toEqual([
      '2026-10-05', // lunes
      '2026-10-12',
    ]);
  });

  it('ordena los más vendidos por unidades', async () => {
    await order({
      createdAt: '2026-10-10T15:00:00Z',
      items: [
        { sku: 'A', qty: 1, price: 50000 },
        { sku: 'B', qty: 3, price: 10000 },
      ],
    });
    await order({ createdAt: '2026-10-11T15:00:00Z', items: [{ sku: 'B', qty: 2, price: 10000 }] });

    const res = await owner
      .get(`${REPORTS}/top-products?from=2026-10-01&to=2026-10-31&limit=5`)
      .expect(200);
    expect(res.body).toEqual([
      { productName: 'Producto B', variantName: 'Variante B', sku: 'B', units: 5, revenue: 50000 },
      { productName: 'Producto A', variantName: 'Variante A', sku: 'A', units: 1, revenue: 50000 },
    ]);
  });

  it('calcula la ganancia de productos y deja aparte lo que no tiene costo y el envío', async () => {
    await order({
      createdAt: '2026-10-10T15:00:00Z',
      shippingCost: 8000,
      carrierCost: 6000,
      items: [
        { sku: 'A', qty: 2, price: 20000, discount: 2000, cost: 8000 },
        { sku: 'B', qty: 1, price: 10000, cost: null },
      ],
    });

    const res = await owner.get(`${REPORTS}/margins?from=2026-10-01&to=2026-10-31`).expect(200);
    expect(margins(res)).toMatchObject({
      revenue: 36000,
      cost: 16000,
      profit: 20000,
      marginPct: 55.56,
      unitsWithoutCost: 1,
      revenueWithoutCost: 10000,
      shippingCharged: 8000,
      shippingCarrierCost: 6000,
    });
    expect(margins(res).byProduct).toEqual([
      {
        productName: 'Producto A',
        variantName: 'Variante A',
        sku: 'A',
        units: 2,
        revenue: 36000,
        cost: 16000,
        profit: 20000,
        marginPct: 55.56,
      },
    ]);
  });

  it('sin ventas responde ceros', async () => {
    const salesRes = await owner.get(`${REPORTS}/sales?from=2026-10-01&to=2026-10-02`).expect(200);
    expect(sales(salesRes).summary).toMatchObject({ orders: 0, total: 0, averageTicket: 0 });
    const marginsRes = await owner
      .get(`${REPORTS}/margins?from=2026-10-01&to=2026-10-02`)
      .expect(200);
    expect(margins(marginsRes)).toMatchObject({
      revenue: 0,
      profit: 0,
      marginPct: 0,
      byProduct: [],
    });
  });
});
