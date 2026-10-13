import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import sharp from 'sharp';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const ADMIN = '/api/v1/admin';
const STORE = '/api/v1/store';

type Agent = Awaited<ReturnType<typeof loginAgent>>;
type IdBody = { id: string };
type PublicList = {
  total: number;
  items: Array<{ slug: string; variants: Array<{ stock: number }> }>;
};

// Las fotos se guardan en una carpeta temporal, nunca en la carpeta de imágenes de desarrollo.
const uploadsDir = mkdtempSync(join(tmpdir(), 'sky-beauty-uploads-'));
process.env.UPLOADS_DIR = uploadsDir;

const idOf = (res: request.Response) => (res.body as IdBody).id;
const slugsOf = (res: request.Response) => (res.body as PublicList).items.map((p) => p.slug);

describe('Catálogo (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let owner: Agent;
  let brandId: string;
  let otherBrandId: string;
  let parentId: string;
  let subcategoryId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
    await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
    owner = await loginAgent(app, 'duena@ejemplo.test');

    brandId = idOf(
      await owner.post(`${ADMIN}/brands`).send({ name: 'Marca Ficticia Test' }).expect(201),
    );
    otherBrandId = idOf(
      await owner.post(`${ADMIN}/brands`).send({ name: 'Otra Marca Test' }).expect(201),
    );
    parentId = idOf(
      await owner.post(`${ADMIN}/categories`).send({ name: 'Categoría Padre Test' }).expect(201),
    );
    subcategoryId = idOf(
      await owner
        .post(`${ADMIN}/categories`)
        .send({ name: 'Subcategoría Test', parentId })
        .expect(201),
    );
  });

  afterAll(async () => {
    await app.close();
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  /** Crea un producto con una variante y lo deja con el estado indicado. */
  async function createProduct(
    name: string,
    opts: { brand?: string; category?: string; status?: string } = {},
  ): Promise<{ productId: string; variantId: string }> {
    const productId = idOf(
      await owner
        .post(`${ADMIN}/products`)
        .send({
          name,
          description: 'Producto ficticio para pruebas.',
          brandId: opts.brand ?? brandId,
          categoryId: opts.category ?? subcategoryId,
          basePrice: 10000,
        })
        .expect(201),
    );
    const variantId = idOf(
      await owner
        .post(`${ADMIN}/products/${productId}/variants`)
        .send({ sku: `SKU-${name.replace(/\W+/g, '-')}`, name: 'Tono prueba' })
        .expect(201),
    );
    if (opts.status !== 'DRAFT') {
      await owner
        .patch(`${ADMIN}/products/${productId}/status`)
        .send({ status: opts.status ?? 'ACTIVE' })
        .expect(200);
    }
    return { productId, variantId };
  }

  it('la propietaria crea un producto con variante y fotos, lo publica y la tienda lo muestra', async () => {
    const { productId, variantId } = await createProduct('Labial Rubí Test', { status: 'DRAFT' });

    const png = await sharp({
      create: { width: 40, height: 40, channels: 3, background: '#b785b8' },
    })
      .png()
      .toBuffer();
    await owner
      .post(`${ADMIN}/products/${productId}/images`)
      .attach('file', png, { filename: 'general.png', contentType: 'image/png' })
      .expect(201);
    await owner
      .post(`${ADMIN}/products/${productId}/images`)
      .field('variantId', variantId)
      .attach('file', png, { filename: 'tono.png', contentType: 'image/png' })
      .expect(201);

    // En borrador no aparece en la tienda.
    await request(app.getHttpServer()).get(`${STORE}/products/labial-rubi-test`).expect(404);

    await owner
      .patch(`${ADMIN}/products/${productId}/status`)
      .send({ status: 'ACTIVE' })
      .expect(200);

    const detail = await request(app.getHttpServer())
      .get(`${STORE}/products/labial-rubi-test`)
      .expect(200);
    const body = detail.body as {
      images: Array<{ url: string; thumbnailUrl: string }>;
      variants: Array<{ id: string; stock: number; images: unknown[] }>;
    };
    expect(body.images).toHaveLength(1);
    expect(body.variants).toHaveLength(1);
    expect(body.variants[0].images).toHaveLength(1);
    // Sin existencias registradas sigue visible (agotado).
    expect(body.variants[0].stock).toBe(0);
    // No expone el costo de compra.
    expect(JSON.stringify(detail.body)).not.toContain('costPrice');

    // La foto se sirve desde el disco del servidor.
    const path = new URL(body.images[0].url).pathname;
    await request(app.getHttpServer())
      .get(path)
      .expect(200)
      .expect('content-type', /image\/webp/);
  });

  it('filtra por categoría (incluye subcategorías), por marca y busca sin tildes ni mayúsculas', async () => {
    await createProduct('Labial Rubí Test');
    await createProduct('Base Líquida Test', { brand: otherBrandId });
    const otherCategory = idOf(
      await owner.post(`${ADMIN}/categories`).send({ name: 'Otra Categoría Test' }).expect(201),
    );
    await createProduct('Sombra Otra Categoría Test', { category: otherCategory });

    const server = app.getHttpServer();
    const byParent = await request(server)
      .get(`${STORE}/products`)
      .query({ categoryId: parentId })
      .expect(200);
    expect(slugsOf(byParent).sort()).toEqual(['base-liquida-test', 'labial-rubi-test']);

    const byBrand = await request(server)
      .get(`${STORE}/products`)
      .query({ brandId: otherBrandId })
      .expect(200);
    expect(slugsOf(byBrand)).toEqual(['base-liquida-test']);

    const search = await request(server).get(`${STORE}/products`).query({ q: 'RUBI' }).expect(200);
    expect(slugsOf(search)).toEqual(['labial-rubi-test']);
    expect((search.body as PublicList).total).toBe(1);

    const accented = await request(server)
      .get(`${STORE}/products`)
      .query({ q: 'líquida' })
      .expect(200);
    expect(slugsOf(accented)).toEqual(['base-liquida-test']);
  });

  it('solo muestra productos activos', async () => {
    await createProduct('Activo Test');
    await createProduct('Borrador Test', { status: 'DRAFT' });
    await createProduct('Inactivo Test', { status: 'INACTIVE' });
    await createProduct('Archivado Test', { status: 'ARCHIVED' });

    const list = await request(app.getHttpServer()).get(`${STORE}/products`).expect(200);
    expect(slugsOf(list)).toEqual(['activo-test']);
    for (const slug of ['borrador-test', 'inactivo-test', 'archivado-test']) {
      await request(app.getHttpServer()).get(`${STORE}/products/${slug}`).expect(404);
    }
  });

  it('respeta las reglas entre categorías', async () => {
    // Máximo dos niveles.
    await owner
      .post(`${ADMIN}/categories`)
      .send({ name: 'Tercer Nivel Test', parentId: subcategoryId })
      .expect(400);
    // Un producto no puede ir en una categoría que tiene subcategorías.
    await owner
      .post(`${ADMIN}/products`)
      .send({
        name: 'Producto En Padre Test',
        description: 'Producto ficticio.',
        brandId,
        categoryId: parentId,
        basePrice: 10000,
      })
      .expect((res) => expect([400, 409]).toContain(res.status));
  });

  it('el personal crea productos, pero no ve ni fija el costo de compra', async () => {
    const staff = await loginAgent(app, 'personal@ejemplo.test');
    const productId = idOf(
      await staff
        .post(`${ADMIN}/products`)
        .send({
          name: 'Producto Personal Test',
          description: 'Producto ficticio.',
          brandId,
          categoryId: subcategoryId,
          basePrice: 10000,
        })
        .expect(201),
    );
    const variant = await staff
      .post(`${ADMIN}/products/${productId}/variants`)
      .send({ sku: 'SKU-PERSONAL', name: 'Tono prueba', costPrice: 4000 })
      .expect(201);
    expect(variant.body).not.toHaveProperty('costPrice');

    const stored = await prisma.productVariant.findUniqueOrThrow({ where: { id: idOf(variant) } });
    expect(stored.costPrice).toBeNull();
  });

  it('registra el historial de precios en cada cambio del precio efectivo', async () => {
    const { productId, variantId } = await createProduct('Historial Test');

    await owner
      .patch(`${ADMIN}/products/${productId}/variants/${variantId}`)
      .send({ price: 12000 })
      .expect(200);
    // El precio base ya no afecta a la variante con precio propio.
    await owner.patch(`${ADMIN}/products/${productId}`).send({ basePrice: 15000 }).expect(200);

    const history = await prisma.variantPriceHistory.findMany({
      where: { variantId },
      orderBy: { validFrom: 'asc' },
    });
    expect(history.map((h) => h.price.toNumber())).toEqual([10000, 12000]);
  });
});
