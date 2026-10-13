import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import { PricingService } from '../src/modules/promotions/pricing.service';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const PROMOTIONS = '/api/v1/admin/promotions';
const STORE_PRODUCTS = '/api/v1/store/products';

type Agent = Awaited<ReturnType<typeof loginAgent>>;
type PublicProduct = {
  hasDiscount: boolean;
  regularPriceFrom: number;
  finalPriceFrom: number;
  variants: Array<{
    id: string;
    regularPrice: number;
    discountAmount: number;
    finalPrice: number;
    promotionName: string | null;
  }>;
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Promociones y precios (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let pricing: PricingService;
  let owner: Agent;
  let productId: string;
  let variantId: string;
  let otherVariantId: string;
  let parentId: string;
  let subcategoryId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    pricing = app.get(PricingService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
    await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
    owner = await loginAgent(app, 'duena@ejemplo.test');

    const brand = await prisma.brand.create({
      data: { name: 'Marca Promo Test', slug: 'marca-promo-test' },
    });
    const parent = await prisma.category.create({
      data: { name: 'Categoría Promo Test', slug: 'categoria-promo-test' },
    });
    const sub = await prisma.category.create({
      data: {
        name: 'Subcategoría Promo Test',
        slug: 'subcategoria-promo-test',
        parentId: parent.id,
      },
    });
    parentId = parent.id;
    subcategoryId = sub.id;

    // El producto y sus variantes se crean por la API para que quede el historial de precios.
    productId = (
      (
        await owner
          .post('/api/v1/admin/products')
          .send({
            name: 'Producto Promo Test',
            description: 'Producto ficticio para pruebas de promociones.',
            brandId: brand.id,
            categoryId: subcategoryId,
            basePrice: 10000,
          })
          .expect(201)
      ).body as { id: string }
    ).id;
    const createVariant = async (sku: string) =>
      (
        (
          await owner
            .post(`/api/v1/admin/products/${productId}/variants`)
            .send({ sku, name: sku })
            .expect(201)
        ).body as { id: string }
      ).id;
    variantId = await createVariant('PROMO-TEST-1');
    otherVariantId = await createVariant('PROMO-TEST-2');
    await owner
      .patch(`/api/v1/admin/products/${productId}/status`)
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  afterAll(() => app.close());

  const body = (overrides: Record<string, unknown> = {}) => ({
    name: 'Promoción ficticia',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    scope: 'PRODUCT',
    productIds: [productId],
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  });

  const createPromotion = async (overrides: Record<string, unknown> = {}) =>
    (await owner.post(PROMOTIONS).send(body(overrides)).expect(201)).body as {
      id: string;
      updatedAt: string;
    };

  const storeProduct = async () =>
    (await request(app.getHttpServer()).get(`${STORE_PRODUCTS}/producto-promo-test`).expect(200))
      .body as PublicProduct;

  describe('gestión', () => {
    it('solo la propietaria gestiona promociones', async () => {
      const staff = await loginAgent(app, 'personal@ejemplo.test');
      await staff.get(PROMOTIONS).expect(403);
      await staff.post(PROMOTIONS).send(body()).expect(403);
      await request(app.getHttpServer()).get(PROMOTIONS).expect(401);
    });

    it('respeta el límite de descuento porcentual configurado', async () => {
      await prisma.storeSettings.update({
        where: { id: 'default' },
        data: { maxPercentageDiscount: 30 },
      });
      await owner
        .post(PROMOTIONS)
        .send(body({ discountValue: 30.5 }))
        .expect(400);
      await owner
        .post(PROMOTIONS)
        .send(body({ discountValue: 30 }))
        .expect(201);
      // El límite es solo para porcentajes.
      await owner
        .post(PROMOTIONS)
        .send(body({ discountType: 'FIXED_AMOUNT', discountValue: 5000 }))
        .expect(201);
    });

    it('sin límite configurado solo aplica el tope técnico del 100 %', async () => {
      await owner
        .post(PROMOTIONS)
        .send(body({ discountValue: 100 }))
        .expect(201);
      await owner
        .post(PROMOTIONS)
        .send(body({ discountValue: 100.5 }))
        .expect(400);
    });

    it('valida fechas, destinos y valores', async () => {
      const now = Date.now();
      await owner
        .post(PROMOTIONS)
        .send(body({ startsAt: new Date(now).toISOString(), endsAt: new Date(now).toISOString() }))
        .expect(400);
      await owner
        .post(PROMOTIONS)
        .send(body({ productIds: [] }))
        .expect(400);
      await owner
        .post(PROMOTIONS)
        .send(body({ productIds: ['00000000-0000-4000-8000-000000000000'] }))
        .expect(400);
      await owner
        .post(PROMOTIONS)
        .send(body({ discountValue: 0 }))
        .expect(400);
    });

    it('guarda una versión en cada creación y cambio', async () => {
      const created = await createPromotion();
      await owner
        .patch(`${PROMOTIONS}/${created.id}`)
        .send(body({ discountValue: 20 }))
        .expect(200);

      const revisions = (await owner.get(`${PROMOTIONS}/${created.id}/revisions`).expect(200))
        .body as Array<{ revision: number; discountValue: number }>;
      expect(revisions.map((r) => [r.revision, r.discountValue])).toEqual([
        [2, 20],
        [1, 10],
      ]);
    });

    it('ediciones simultáneas: se aplica una y las demás se rechazan sin romper las versiones', async () => {
      const created = await createPromotion();
      const results = await Promise.all(
        [20, 30, 40].map((discountValue) =>
          owner.patch(`${PROMOTIONS}/${created.id}`).send(body({ discountValue })),
        ),
      );
      const ok = results.filter((res) => res.status === 200).length;
      expect(ok).toBeGreaterThanOrEqual(1);
      for (const res of results) expect([200, 409]).toContain(res.status);

      const revisions = await prisma.promotionRevision.findMany({
        where: { promotionId: created.id },
        orderBy: { revision: 'asc' },
      });
      expect(revisions.map((r) => r.revision)).toEqual(
        Array.from({ length: 1 + ok }, (_, i) => i + 1),
      );
      // La promoción y su última versión coinciden.
      const promotion = await prisma.promotion.findUniqueOrThrow({ where: { id: created.id } });
      expect(promotion.discountValue.toNumber()).toBe(
        revisions[revisions.length - 1].discountValue.toNumber(),
      );
    });

    it('filtra por activas e inactivas', async () => {
      await createPromotion({ name: 'Activa' });
      await createPromotion({ name: 'Inactiva', isActive: false });
      const inactive = (await owner.get(`${PROMOTIONS}?isActive=false`).expect(200)).body as {
        items: Array<{ name: string }>;
      };
      expect(inactive.items.map((p) => p.name)).toEqual(['Inactiva']);
    });
  });

  describe('precios en la tienda', () => {
    it('muestra precio regular, descuento y precio final', async () => {
      await createPromotion({ name: 'Diez por ciento' });
      const product = await storeProduct();
      expect(product.hasDiscount).toBe(true);
      expect(product.regularPriceFrom).toBe(10000);
      expect(product.finalPriceFrom).toBe(9000);
      expect(product.variants[0]).toMatchObject({
        regularPrice: 10000,
        discountAmount: 1000,
        finalPrice: 9000,
        promotionName: 'Diez por ciento',
      });
    });

    it('una promoción de la categoría principal aplica al producto de la subcategoría', async () => {
      await createPromotion({ scope: 'CATEGORY', productIds: [], categoryIds: [parentId] });
      const product = await storeProduct();
      expect(product.variants.every((v) => v.finalPrice === 9000)).toBe(true);
    });

    it('una promoción de variante solo cambia esa variante', async () => {
      await createPromotion({
        scope: 'VARIANT',
        productIds: [],
        variantIds: [variantId],
        discountType: 'FIXED_AMOUNT',
        discountValue: 2500,
      });
      const product = await storeProduct();
      const byId = new Map(product.variants.map((v) => [v.id, v]));
      expect(byId.get(variantId)?.finalPrice).toBe(7500);
      expect(byId.get(otherVariantId)?.finalPrice).toBe(10000);
      expect(product.finalPriceFrom).toBe(7500);
    });

    it('no acumula: con varias aplica la de mayor descuento', async () => {
      await createPromotion({ discountValue: 10 });
      await createPromotion({
        scope: 'CATEGORY',
        productIds: [],
        categoryIds: [subcategoryId],
        discountValue: 25,
      });
      const product = await storeProduct();
      expect(product.variants[0]).toMatchObject({ discountAmount: 2500, finalPrice: 7500 });
    });

    it('el precio "desde" y su precio regular son de la misma variante', async () => {
      // Variante 1: 10.000 sin descuento. Variante 2: 20.000 con 55 % → 9.000.
      await owner
        .patch(`/api/v1/admin/products/${productId}/variants/${otherVariantId}`)
        .send({ price: 20000 })
        .expect(200);
      await createPromotion({
        scope: 'VARIANT',
        productIds: [],
        variantIds: [otherVariantId],
        discountValue: 55,
      });
      const product = await storeProduct();
      expect(product.finalPriceFrom).toBe(9000);
      expect(product.regularPriceFrom).toBe(20000);
    });

    it('sin promociones vigentes no muestra descuento', async () => {
      await createPromotion({ isActive: false });
      await createPromotion({
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        endsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      });
      const product = await storeProduct();
      expect(product.hasDiscount).toBe(false);
      expect(product.finalPriceFrom).toBe(10000);
    });
  });

  describe('cálculo a una fecha', () => {
    it('usa la versión de la promoción y el precio vigentes en esa fecha', async () => {
      const created = await createPromotion({ discountValue: 10 });
      await pause(50);
      const before = new Date();
      await pause(50);

      // Después de "before": la promoción sube al 50 % y la variante cambia de precio.
      await owner
        .patch(`${PROMOTIONS}/${created.id}`)
        .send(body({ discountValue: 50 }))
        .expect(200);
      await owner
        .patch(`/api/v1/admin/products/${productId}/variants/${variantId}`)
        .send({ price: 20000 })
        .expect(200);

      await expect(pricing.priceVariantAt(variantId, before)).resolves.toMatchObject({
        regularPrice: 10000,
        discountAmount: 1000,
        finalPrice: 9000,
      });
      await expect(pricing.priceVariantAt(variantId)).resolves.toMatchObject({
        regularPrice: 20000,
        discountAmount: 10000,
        finalPrice: 10000,
      });
    });

    it('una promoción creada después de la fecha no aplica a esa fecha', async () => {
      const before = new Date();
      await pause(50);
      await createPromotion({ startsAt: new Date(Date.now() - 86_400_000).toISOString() });

      await expect(pricing.priceVariantAt(variantId, before)).resolves.toMatchObject({
        discountAmount: 0,
        appliedPromotion: null,
      });
    });

    it('una promoción que se desactivó después de la fecha sigue aplicando a esa fecha', async () => {
      const created = await createPromotion({ discountValue: 15 });
      await pause(50);
      const before = new Date();
      await pause(50);
      await owner
        .patch(`${PROMOTIONS}/${created.id}`)
        .send(body({ discountValue: 15, isActive: false }))
        .expect(200);

      await expect(pricing.priceVariantAt(variantId, before)).resolves.toMatchObject({
        discountAmount: 1500,
      });
      await expect(pricing.priceVariantAt(variantId)).resolves.toMatchObject({
        discountAmount: 0,
      });
    });

    it('calcula varias variantes en una sola llamada', async () => {
      await createPromotion({ scope: 'VARIANT', productIds: [], variantIds: [variantId] });
      const prices = await pricing.priceVariantsAt([variantId, otherVariantId, variantId]);
      expect(prices.size).toBe(2);
      expect(prices.get(variantId)?.finalPrice).toBe(9000);
      expect(prices.get(otherVariantId)?.finalPrice).toBe(10000);
    });
  });
});
