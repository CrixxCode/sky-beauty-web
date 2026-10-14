import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { AdminRole } from '../src/generated/prisma/client';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const QUOTE = '/api/v1/store/orders/quote';
const ORDERS = '/api/v1/store/orders';
const TRACKING = '/api/v1/store/orders/tracking';
const RIOHACHA = '44001';
const MEDELLIN = '05001';

type QuoteItem = {
  variantId: string;
  quantity: number;
  maxQuantity: number;
  issue: string | null;
  unitListPrice: number;
  unitDiscount: number;
  unitFinalPrice: number;
  lineTotal: number;
};
type Quote = {
  items: QuoteItem[];
  subtotal: number;
  discountTotal: number;
  shippingCost: number | null;
  total: number;
  shippingLabel: string;
  availablePaymentMethods: Array<{ id: string; code: string }>;
  unavailableVariantIds: string[];
  canCheckout: boolean;
};
type Created = {
  id: string;
  code: string;
  publicToken: string;
  trackingPath: string;
  whatsappMessage: string;
  whatsappUrl: string | null;
  summary: { total: number; shippingCost: number | null; shippingLabel: string };
};

describe('Carrito y checkout (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let variantId: string;
  let otherVariantId: string;
  let transferId: string;
  let codId: string;

  const server = () => app.getHttpServer();

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);

    const brand = await prisma.brand.create({
      data: { name: 'Marca Checkout Test', slug: 'marca-checkout-test' },
    });
    const category = await prisma.category.create({
      data: { name: 'Categoría Checkout Test', slug: 'categoria-checkout-test' },
    });
    const product = await prisma.product.create({
      data: {
        name: 'Producto Checkout Test',
        slug: 'producto-checkout-test',
        description: 'Producto ficticio para pruebas del checkout.',
        brandId: brand.id,
        categoryId: category.id,
        basePrice: 20000,
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });
    const makeVariant = async (sku: string, stock: number, maxPerOrder: number | null = null) => {
      const v = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku,
          name: `Tono ${sku}`,
          stock,
          maxPerOrder,
          costPrice: 8000,
        },
      });
      await prisma.inventoryMovement.create({
        data: {
          variantId: v.id,
          type: 'INITIAL',
          quantity: stock,
          stockBefore: 0,
          stockAfter: stock,
          reason: '',
        },
      });
      return v.id;
    };
    variantId = await makeVariant('CHK-001', 5);
    otherVariantId = await makeVariant('CHK-002', 10, 2);

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
          maxOrderTotal: 100000,
          cities: { create: { municipalityCode: RIOHACHA } },
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  const quote = async (
    items: Array<{ variantId: string; quantity: number }>,
    municipalityCode?: string,
  ) =>
    (await request(server()).post(QUOTE).send({ items, municipalityCode }).expect(201))
      .body as Quote;

  const orderBody = (overrides: Record<string, unknown> = {}) => ({
    items: [{ variantId, quantity: 2 }],
    municipalityCode: RIOHACHA,
    customerName: 'Cliente Ficticio',
    customerPhone: '300 111 2233',
    addressLine: 'Dirección ficticia 123',
    deliveryNotes: 'Portería ficticia',
    paymentMethodId: transferId,
    idempotencyKey: `checkout-${Date.now()}-${Math.random()}`,
    termsAccepted: true,
    dataProcessingAccepted: true,
    ...overrides,
  });

  const stockOf = async (id: string) =>
    (await prisma.productVariant.findUniqueOrThrow({ where: { id } })).stock;

  describe('cotización', () => {
    it('calcula en el servidor precios, descuentos y total', async () => {
      const now = Date.now();
      const promotion = await prisma.promotion.create({
        data: {
          name: 'Promo checkout',
          discountType: 'PERCENTAGE',
          discountValue: 10,
          scope: 'VARIANT',
          startsAt: new Date(now - 60_000),
          endsAt: new Date(now + 86_400_000),
          createdAt: new Date(now - 60_000),
          variants: { create: { variantId } },
        },
      });
      await prisma.promotionRevision.create({
        data: {
          promotionId: promotion.id,
          revision: 1,
          validFrom: new Date(now - 60_000),
          name: promotion.name,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          scope: 'VARIANT',
          startsAt: promotion.startsAt,
          endsAt: promotion.endsAt,
          isActive: true,
          variantIds: [variantId],
        },
      });

      const q = await quote([{ variantId, quantity: 2 }]);
      expect(q.items[0]).toMatchObject({
        unitListPrice: 20000,
        unitDiscount: 2000,
        unitFinalPrice: 18000,
        lineTotal: 36000,
        issue: null,
      });
      expect(q).toMatchObject({
        subtotal: 40000,
        discountTotal: 4000,
        total: 36000,
        canCheckout: true,
      });
      // No expone las existencias.
      expect(q.items[0]).not.toHaveProperty('stock');
    });

    it('marca los artículos con problemas sin fallar y bloquea el checkout', async () => {
      await prisma.productVariant.update({
        where: { id: otherVariantId },
        data: { isActive: false },
      });
      const q = await quote([
        { variantId, quantity: 6 },
        { variantId: otherVariantId, quantity: 1 },
      ]);
      expect(q.items).toHaveLength(1);
      expect(q.items[0]).toMatchObject({ issue: 'INSUFFICIENT_STOCK', maxQuantity: 5 });
      expect(q.unavailableVariantIds).toEqual([otherVariantId]);
      expect(q.canCheckout).toBe(false);
    });

    it('respeta el máximo por pedido de cada variante', async () => {
      const q = await quote([{ variantId: otherVariantId, quantity: 3 }]);
      expect(q.items[0]).toMatchObject({ issue: 'OVER_MAX_PER_ORDER', maxQuantity: 2 });
      expect(q.canCheckout).toBe(false);
    });

    it('aplica el tope general de unidades por producto; si la variante tiene uno menor, gana el suyo', async () => {
      await prisma.storeSettings.updateMany({ data: { maxUnitsPerProduct: 3 } });

      const q = await quote([
        { variantId, quantity: 4 },
        { variantId: otherVariantId, quantity: 2 },
      ]);
      expect(q.items[0]).toMatchObject({
        issue: 'OVER_MAX_PER_ORDER',
        maxPerOrder: 3,
        maxQuantity: 3,
      });
      expect(q.items[1]).toMatchObject({ issue: null, maxPerOrder: 2 });

      const created = await request(server())
        .post(ORDERS)
        .send(orderBody({ items: [{ variantId, quantity: 4 }] }))
        .expect(400);
      expect((created.body as { message: string }).message).toContain('máximo 3 unidades');

      // La tienda muestra el máximo que aplica a cada variante.
      const product = await request(server())
        .get('/api/v1/store/products/producto-checkout-test')
        .expect(200);
      const variants = (product.body as { variants: Array<{ sku: string; maxPerOrder: number }> })
        .variants;
      expect(Object.fromEntries(variants.map((v) => [v.sku, v.maxPerOrder]))).toEqual({
        'CHK-001': 3,
        'CHK-002': 2,
      });
    });

    it('envío: gratis nacional > gratis por monto > tarifa del municipio > por confirmar', async () => {
      await prisma.municipalShippingRate.create({
        data: { municipalityCode: RIOHACHA, amount: 5000 },
      });
      const items = [{ variantId, quantity: 2 }]; // 40.000

      expect(await quote(items, MEDELLIN)).toMatchObject({
        shippingCost: null,
        shippingLabel: 'Envío por confirmar',
        total: 40000,
      });
      expect(await quote(items, RIOHACHA)).toMatchObject({ shippingCost: 5000, total: 45000 });

      await prisma.storeSettings.update({
        where: { id: 'default' },
        data: { freeShippingThreshold: 40000 },
      });
      expect(await quote(items, RIOHACHA)).toMatchObject({
        shippingCost: 0,
        shippingLabel: 'Envío gratis',
      });
      expect(await quote([{ variantId, quantity: 1 }], RIOHACHA)).toMatchObject({
        shippingCost: 5000,
      });

      await prisma.storeSettings.update({
        where: { id: 'default' },
        data: { nationalFreeShipping: true },
      });
      expect(await quote([{ variantId, quantity: 1 }], MEDELLIN)).toMatchObject({
        shippingCost: 0,
      });
    });

    it('el contra entrega solo aparece en sus municipios y hasta su monto máximo', async () => {
      const codes = (q: Quote) => q.availablePaymentMethods.map((m) => m.code);
      expect(codes(await quote([{ variantId, quantity: 1 }], RIOHACHA))).toContain(
        'CASH_ON_DELIVERY',
      );
      expect(codes(await quote([{ variantId, quantity: 1 }], MEDELLIN))).not.toContain(
        'CASH_ON_DELIVERY',
      );
      await prisma.paymentMethod.update({ where: { id: codId }, data: { maxOrderTotal: 30000 } });
      expect(codes(await quote([{ variantId, quantity: 2 }], RIOHACHA))).not.toContain(
        'CASH_ON_DELIVERY',
      );
    });
  });

  describe('creación del pedido', () => {
    it('registra el pedido con snapshots, cliente, reserva y enlace de seguimiento', async () => {
      const res = await request(server()).post(ORDERS).send(orderBody()).expect(201);
      const created = res.body as Created;

      expect(created.code).toMatch(/^SB-\d{6}-[0-9A-F]{6}$/);
      expect(created.trackingPath).toBe(`/seguimiento/${created.publicToken}`);
      expect(await stockOf(variantId)).toBe(3);

      const order = await prisma.order.findUniqueOrThrow({
        where: { id: created.id },
        include: { items: true, customer: true },
      });
      expect(order).toMatchObject({
        status: 'PENDING_CONFIRMATION',
        paymentStatus: 'PENDING',
        customerPhone: '573001112233',
        city: 'Riohacha',
        department: 'La Guajira',
        paymentMethodName: 'Transferencia bancaria',
      });
      expect(order.customer.phone).toBe('573001112233');
      expect(order.termsAcceptedAt).toBeInstanceOf(Date);
      expect(order.dataProcessingConsentAt).toBeInstanceOf(Date);
      expect(order.items[0]).toMatchObject({
        productName: 'Producto Checkout Test',
        variantName: 'Tono CHK-001',
        sku: 'CHK-001',
        quantity: 2,
      });
      expect(order.items[0].unitCost?.toNumber()).toBe(8000);

      const movement = await prisma.inventoryMovement.findFirstOrThrow({
        where: { orderId: order.id },
      });
      expect(movement).toMatchObject({ type: 'ORDER_RESERVED', quantity: -2, stockAfter: 3 });

      // El enlace privado funciona.
      await request(server()).get(`${TRACKING}/${created.publicToken}`).expect(200);
    });

    it('los cambios posteriores del catálogo no alteran el pedido', async () => {
      const created = (await request(server()).post(ORDERS).send(orderBody()).expect(201))
        .body as Created;
      await prisma.product.updateMany({ data: { name: 'Nombre cambiado' } });
      await prisma.productVariant.update({ where: { id: variantId }, data: { price: 99999 } });
      const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: created.id } });
      expect(item.productName).toBe('Producto Checkout Test');
      expect(item.unitFinalPrice.toNumber()).toBe(20000);
    });

    it('exige las dos casillas por separado', async () => {
      await request(server())
        .post(ORDERS)
        .send(orderBody({ termsAccepted: false }))
        .expect(400);
      await request(server())
        .post(ORDERS)
        .send(orderBody({ dataProcessingAccepted: false }))
        .expect(400);
      expect(await prisma.order.count()).toBe(0);
    });

    it('no crea el pedido sin existencias, sobre el máximo o con un método no disponible', async () => {
      await request(server())
        .post(ORDERS)
        .send(orderBody({ items: [{ variantId, quantity: 6 }] }))
        .expect(400);
      await request(server())
        .post(ORDERS)
        .send(orderBody({ items: [{ variantId: otherVariantId, quantity: 3 }] }))
        .expect(400);
      await request(server())
        .post(ORDERS)
        .send(orderBody({ municipalityCode: MEDELLIN, paymentMethodId: codId }))
        .expect(400);
      expect(await prisma.order.count()).toBe(0);
      expect(await stockOf(variantId)).toBe(5);
    });

    it('dos clientes por la última unidad: solo uno la obtiene', async () => {
      await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 1 } });
      const results = await Promise.all(
        [1, 2, 3].map(() =>
          request(server())
            .post(ORDERS)
            .send(orderBody({ items: [{ variantId, quantity: 1 }] })),
        ),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await stockOf(variantId)).toBe(0);
    });
  });

  describe('idempotencia', () => {
    it('un reintento devuelve el mismo pedido sin volver a reservar', async () => {
      const body = orderBody();
      const first = (await request(server()).post(ORDERS).send(body).expect(201)).body as Created;
      // Aunque ya no queden existencias para repetir la compra, el reintento funciona.
      await prisma.productVariant.update({ where: { id: variantId }, data: { stock: 0 } });
      const second = (await request(server()).post(ORDERS).send(body).expect(201)).body as Created;

      expect(second).toEqual(first);
      expect(await prisma.order.count()).toBe(1);
      expect(await prisma.inventoryMovement.count({ where: { type: 'ORDER_RESERVED' } })).toBe(1);
    });

    it('envíos simultáneos con la misma clave crean un solo pedido', async () => {
      const body = orderBody();
      const results = await Promise.all(
        [1, 2, 3].map(() => request(server()).post(ORDERS).send(body)),
      );
      for (const r of results) expect(r.status).toBe(201);
      const codes = new Set(results.map((r) => (r.body as Created).code));
      expect(codes.size).toBe(1);
      expect(await prisma.order.count()).toBe(1);
      expect(await stockOf(variantId)).toBe(3);
    });

    it('la misma clave con otros datos se rechaza', async () => {
      const body = orderBody();
      await request(server()).post(ORDERS).send(body).expect(201);
      await request(server())
        .post(ORDERS)
        .send({ ...body, addressLine: 'Otra dirección ficticia' })
        .expect(409);
    });
  });

  describe('mensaje de WhatsApp', () => {
    it('identifica el pedido e incluye productos, importes y datos de entrega', async () => {
      await prisma.storeSettings.update({
        where: { id: 'default' },
        data: { whatsappNumber: '573000000000' },
      });
      const created = (await request(server()).post(ORDERS).send(orderBody()).expect(201))
        .body as Created;
      const message = created.whatsappMessage.replaceAll(String.fromCharCode(160), ' ');

      expect(message).toContain(`pedido ${created.code}`);
      expect(message).toContain('- Producto Checkout Test (Tono CHK-001) x2: $ 40.000');
      expect(message).toContain('Envío por confirmar');
      expect(message).toContain('Total sin envío: $ 40.000');
      expect(message).toContain('Nombre: Cliente Ficticio');
      expect(message).toContain('Teléfono: 573001112233');
      expect(message).toContain('Municipio: Riohacha, La Guajira');
      expect(message).toContain('Dirección: Dirección ficticia 123');
      expect(message).toContain('Indicaciones: Portería ficticia');
      expect(message).toContain('Método de pago: Transferencia bancaria');
      // El enlace de seguimiento queda en el chat del cliente y abre su pedido.
      const trackingUrl = `http://localhost:3000/seguimiento/${created.publicToken}`;
      expect(message).toContain(`Seguimiento del pedido: ${trackingUrl}`);
      expect((created as Created & { trackingUrl: string }).trackingUrl).toBe(trackingUrl);
      expect(created.whatsappUrl).toBe(
        `https://wa.me/573000000000?text=${encodeURIComponent(created.whatsappMessage)}`,
      );
    });

    it('el panel muestra el mismo enlace de seguimiento para reenviárselo al cliente', async () => {
      const created = (await request(server()).post(ORDERS).send(orderBody()).expect(201))
        .body as Created;
      await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
      const staff = await loginAgent(app, 'personal@ejemplo.test');
      const detail = (await staff.get(`/api/v1/admin/orders/${created.id}`).expect(200)).body as {
        trackingUrl: string;
      };
      expect(detail.trackingUrl).toBe(`http://localhost:3000/seguimiento/${created.publicToken}`);
      const token = detail.trackingUrl.split('/seguimiento/')[1];
      await request(server()).get(`${TRACKING}/${token}`).expect(200);
    });

    it('sin número de WhatsApp configurado no ofrece el enlace', async () => {
      const created = (await request(server()).post(ORDERS).send(orderBody()).expect(201))
        .body as Created;
      expect(created.whatsappUrl).toBeNull();
    });
  });
});
