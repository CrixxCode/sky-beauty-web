import { existsSync, rmSync } from 'node:fs';
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

// Carpeta temporal de las fotos de las pruebas (test/setup-env.ts).
const uploadsDir = process.env.UPLOADS_DIR as string;

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
    const path = body.images[0].url;
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

  it('renombrar un producto mantiene su enlace; solo cambia si se envía un enlace nuevo (Q-07)', async () => {
    const { productId } = await createProduct('Gloss Original Test');
    const server = app.getHttpServer();

    await owner
      .patch(`${ADMIN}/products/${productId}`)
      .send({ name: 'Gloss Renombrado Test' })
      .expect(200)
      .expect((res) => expect((res.body as { slug: string }).slug).toBe('gloss-original-test'));
    await request(server).get(`${STORE}/products/gloss-original-test`).expect(200);
    await request(server).get(`${STORE}/products/gloss-renombrado-test`).expect(404);

    // Elegir un enlace nuevo sí es posible, de forma explícita.
    await owner
      .patch(`${ADMIN}/products/${productId}`)
      .send({ slug: 'gloss-nuevo-test' })
      .expect(200);
    await request(server).get(`${STORE}/products/gloss-nuevo-test`).expect(200);
  });

  it('no se publica un producto sin variantes activas (Q-18)', async () => {
    const productId = idOf(
      await owner
        .post(`${ADMIN}/products`)
        .send({
          name: 'Sin Variantes Test',
          description: 'Producto ficticio.',
          brandId,
          categoryId: subcategoryId,
          basePrice: 10000,
        })
        .expect(201),
    );
    const publish = () =>
      owner.patch(`${ADMIN}/products/${productId}/status`).send({ status: 'ACTIVE' });

    // Sin variantes.
    await publish()
      .expect(400)
      .expect((res) =>
        expect((res.body as { message: string }).message).toBe(
          'Para publicar el producto agrega al menos una variante activa.',
        ),
      );

    // Con una variante, pero desactivada.
    const variantId = idOf(
      await owner
        .post(`${ADMIN}/products/${productId}/variants`)
        .send({ sku: 'SKU-SIN-VARIANTES', name: 'Tono prueba' })
        .expect(201),
    );
    await owner
      .patch(`${ADMIN}/products/${productId}/variants/${variantId}`)
      .send({ isActive: false })
      .expect(200);
    await publish().expect(400);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).status).toBe(
      'DRAFT',
    );

    // Con una variante activa se publica.
    await owner
      .patch(`${ADMIN}/products/${productId}/variants/${variantId}`)
      .send({ isActive: true })
      .expect(200);
    await publish().expect(200);

    // Despublicar o archivar no exige variantes.
    await owner
      .patch(`${ADMIN}/products/${productId}/status`)
      .send({ status: 'INACTIVE' })
      .expect(200);
  });

  describe('categoría o marca desactivada (Q-09)', () => {
    let rootCategoryId: string;
    let childCategoryId: string;
    let hiddenFlowers: { productId: string; variantId: string };

    beforeEach(async () => {
      rootCategoryId = idOf(
        await owner.post(`${ADMIN}/categories`).send({ name: 'Raíz Visible Test' }).expect(201),
      );
      childCategoryId = idOf(
        await owner
          .post(`${ADMIN}/categories`)
          .send({ name: 'Hija Visible Test', parentId: rootCategoryId })
          .expect(201),
      );
      hiddenFlowers = await createProduct('Producto Oculto Test', { category: childCategoryId });
      await createProduct('Producto Siempre Visible Test');
    });

    const server = () => app.getHttpServer();
    const quote = (variantId: string) =>
      request(server())
        .post(`${STORE}/orders/quote`)
        .send({ items: [{ variantId, quantity: 1 }] })
        .expect(201);

    async function expectHidden(hidden: boolean) {
      const list = await request(server()).get(`${STORE}/products`).expect(200);
      const slugs = slugsOf(list);
      expect(slugs.includes('producto-oculto-test')).toBe(!hidden);
      expect(slugs).toContain('producto-siempre-visible-test');
      await request(server())
        .get(`${STORE}/products/producto-oculto-test`)
        .expect(hidden ? 404 : 200);
      const found = await request(server())
        .get(`${STORE}/products`)
        .query({ ids: hiddenFlowers.productId })
        .expect(200);
      expect(slugsOf(found)).toEqual(hidden ? [] : ['producto-oculto-test']);
      const q = (await quote(hiddenFlowers.variantId)).body as {
        unavailableVariantIds: string[];
        canCheckout: boolean;
      };
      expect(q.unavailableVariantIds).toEqual(hidden ? [hiddenFlowers.variantId] : []);
      // Visible o no, esta variante no tiene existencias; lo que cambia es si la tienda la conoce.
      if (hidden) expect(q.canCheckout).toBe(false);
    }

    it('al desactivar la subcategoría, sus productos desaparecen de la tienda y no se pueden comprar', async () => {
      await expectHidden(false);
      await owner
        .patch(`${ADMIN}/categories/${childCategoryId}`)
        .send({ isActive: false })
        .expect(200);
      await expectHidden(true);
      await owner
        .patch(`${ADMIN}/categories/${childCategoryId}`)
        .send({ isActive: true })
        .expect(200);
      await expectHidden(false);
    });

    it('al desactivar la categoría padre, también se ocultan los productos de sus subcategorías', async () => {
      await owner
        .patch(`${ADMIN}/categories/${rootCategoryId}`)
        .send({ isActive: false })
        .expect(200);
      await expectHidden(true);
      // La búsqueda y la oferta tampoco los devuelven.
      const search = await request(server())
        .get(`${STORE}/products`)
        .query({ q: 'oculto' })
        .expect(200);
      expect(slugsOf(search)).toEqual([]);
    });

    it('al desactivar la marca, sus productos desaparecen y la marca sale del listado', async () => {
      const hiddenBrandId = idOf(
        await owner.post(`${ADMIN}/brands`).send({ name: 'Marca Oculta Test' }).expect(201),
      );
      await owner
        .patch(`${ADMIN}/products/${hiddenFlowers.productId}`)
        .send({ brandId: hiddenBrandId })
        .expect(200);
      const brandSlugs = async () =>
        ((await request(server()).get(`${STORE}/brands`).expect(200)).body as Array<{ id: string }>)
          .map((b) => b.id)
          .sort();
      expect(await brandSlugs()).toContain(hiddenBrandId);

      await owner.patch(`${ADMIN}/brands/${hiddenBrandId}`).send({ isActive: false }).expect(200);
      expect(await brandSlugs()).not.toContain(hiddenBrandId);
      await expectHidden(true);

      await owner.patch(`${ADMIN}/brands/${hiddenBrandId}`).send({ isActive: true }).expect(200);
      await expectHidden(false);
    });

    it('una categoría con productos solo de una marca desactivada no aparece en el árbol', async () => {
      const treeIds = async () =>
        (
          (await request(server()).get(`${STORE}/categories`).expect(200)).body as Array<{
            id: string;
            children: Array<{ id: string }>;
          }>
        ).flatMap((c) => [c.id, ...c.children.map((child) => child.id)]);
      expect(await treeIds()).toContain(childCategoryId);

      const soloBrand = idOf(
        await owner.post(`${ADMIN}/brands`).send({ name: 'Marca Única Test' }).expect(201),
      );
      await owner
        .patch(`${ADMIN}/products/${hiddenFlowers.productId}`)
        .send({ brandId: soloBrand })
        .expect(200);
      await owner.patch(`${ADMIN}/brands/${soloBrand}`).send({ isActive: false }).expect(200);
      expect(await treeIds()).not.toContain(childCategoryId);
    });

    it('un testimonio no enlaza un producto que la tienda oculta', async () => {
      await owner
        .post(`${ADMIN}/testimonials`)
        .send({
          firstName: 'María',
          lastInitial: 'G',
          rating: 5,
          comment: 'Comentario ficticio de prueba.',
          productId: hiddenFlowers.productId,
          isPublished: true,
        })
        .expect(201);
      const product = async () =>
        (
          (await request(server()).get(`${STORE}/testimonials`).expect(200)).body as Array<{
            product: { slug: string } | null;
          }>
        )[0].product;
      expect(await product()).toEqual(expect.objectContaining({ slug: 'producto-oculto-test' }));

      await owner
        .patch(`${ADMIN}/categories/${childCategoryId}`)
        .send({ isActive: false })
        .expect(200);
      expect(await product()).toBeNull();
    });
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

  it('solo la propietaria elimina productos, marcas y categorías', async () => {
    const staff = await loginAgent(app, 'personal@ejemplo.test');
    const productId = idOf(
      await staff
        .post(`${ADMIN}/products`)
        .send({
          name: 'Producto Sin Variantes Test',
          description: 'Producto ficticio.',
          brandId,
          categoryId: subcategoryId,
          basePrice: 10000,
        })
        .expect(201),
    );

    await staff.delete(`${ADMIN}/products/${productId}`).expect(403);
    await staff.delete(`${ADMIN}/brands/${otherBrandId}`).expect(403);
    await staff.delete(`${ADMIN}/categories/${parentId}`).expect(403);
    expect(await prisma.product.count({ where: { id: productId } })).toBe(1);

    await owner.delete(`${ADMIN}/products/${productId}`).expect(204);
    await owner.delete(`${ADMIN}/brands/${otherBrandId}`).expect(204);
  });

  it('elimina un producto sin historial con sus variantes y fotos; con historial pide archivar', async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    const { productId, variantId } = await createProduct('Eliminar Test', { status: 'DRAFT' });
    const image = await owner
      .post(`${ADMIN}/products/${productId}/images`)
      .attach('file', png, { filename: 'foto.png', contentType: 'image/png' })
      .expect(201);
    const { storageKey } = image.body as { storageKey: string };
    expect(existsSync(join(uploadsDir, storageKey))).toBe(true);

    await owner.delete(`${ADMIN}/products/${productId}`).expect(204);
    expect(await prisma.productVariant.count({ where: { id: variantId } })).toBe(0);
    expect(existsSync(join(uploadsDir, 'products', productId))).toBe(false);

    // Con movimientos de inventario no se borra: se conserva el historial.
    const kept = await createProduct('Con Historial Test');
    await owner
      .post(`${ADMIN}/inventory/movements`)
      .send({ variantId: kept.variantId, type: 'INITIAL', quantity: 2 })
      .expect(201);
    const product = await owner.delete(`${ADMIN}/products/${kept.productId}`).expect(409);
    expect((product.body as { message: string }).message).toMatch(
      /movimientos de inventario.*Archívalo/,
    );
    const variant = await owner
      .delete(`${ADMIN}/products/${kept.productId}/variants/${kept.variantId}`)
      .expect(409);
    expect((variant.body as { message: string }).message).toMatch(
      /movimientos de inventario.*Desactívala/,
    );
  });

  it('rechaza una foto demasiado grande mientras la recibe', async () => {
    const { productId } = await createProduct('Foto Grande Test', { status: 'DRAFT' });
    const res = await owner
      .post(`${ADMIN}/products/${productId}/images`)
      .attach('file', Buffer.alloc(11 * 1024 * 1024), {
        filename: 'grande.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect((res.body as { message: string }).message).toBe(
      'El archivo supera el tamaño máximo permitido.',
    );
  });

  it('rechaza con 400 un archivo que no es imagen o una imagen con dimensiones excesivas', async () => {
    const { productId } = await createProduct('Foto Inválida Test', { status: 'DRAFT' });
    const notImage = await owner
      .post(`${ADMIN}/products/${productId}/images`)
      .attach('file', Buffer.from('esto no es una imagen'), {
        filename: 'falsa.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect((notImage.body as { message: string }).message).toBe(
      'El archivo no parece ser una imagen válida.',
    );

    // PNG de 20.000 × 20.000 px que comprime a pocos KB ("bomba de descompresión").
    const { deflateSync, crc32 } = await import('node:zlib');
    const chunk = (type: string, data: Buffer) => {
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      const body = Buffer.concat([Buffer.from(type), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(body));
      return Buffer.concat([length, body, crc]);
    };
    const size = 20_000;
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 1; // 1 bit por píxel
    const png = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(Buffer.alloc(size * (1 + size / 8)))),
      chunk('IEND', Buffer.alloc(0)),
    ]);
    const bomb = await owner
      .post(`${ADMIN}/products/${productId}/images`)
      .attach('file', png, { filename: 'bomba.png', contentType: 'image/png' })
      .expect(400);
    expect((bomb.body as { message: string }).message).toMatch(/dimensiones demasiado grandes/);
    expect(await prisma.productImage.count({ where: { productId } })).toBe(0);
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

  it('filtra destacados, productos en oferta (mayor descuento primero) e ids', async () => {
    const plain = await createProduct('Sin Oferta Test');
    const small = await createProduct('Oferta Pequena Test');
    const big = await createProduct('Oferta Grande Test');
    const draft = await createProduct('Borrador Test', { status: 'DRAFT' });
    await owner
      .patch(`${ADMIN}/products/${plain.productId}`)
      .send({ isFeatured: true })
      .expect(200);

    const promotion = (productId: string, discountValue: number) => ({
      name: `Promoción ficticia ${discountValue}`,
      discountType: 'PERCENTAGE',
      discountValue,
      scope: 'PRODUCT',
      productIds: [productId],
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await owner.post(`${ADMIN}/promotions`).send(promotion(small.productId, 10)).expect(201);
    await owner.post(`${ADMIN}/promotions`).send(promotion(big.productId, 30)).expect(201);
    await owner.post(`${ADMIN}/promotions`).send(promotion(draft.productId, 50)).expect(201);

    const server = app.getHttpServer();
    const featured = await request(server).get(`${STORE}/products?featured=true`).expect(200);
    expect(slugsOf(featured)).toEqual(['sin-oferta-test']);

    const onSale = await request(server).get(`${STORE}/products?onSale=true`).expect(200);
    expect(slugsOf(onSale)).toEqual(['oferta-grande-test', 'oferta-pequena-test']);
    expect((onSale.body as PublicList).total).toBe(2);
    const firstPage = await request(server)
      .get(`${STORE}/products?onSale=true&limit=1`)
      .expect(200);
    expect(slugsOf(firstPage)).toEqual(['oferta-grande-test']);
    expect((firstPage.body as PublicList).total).toBe(2);

    // Ids (favoritos): solo devuelve los publicados.
    const ids = [plain.productId, draft.productId].join(',');
    const byIds = await request(server).get(`${STORE}/products?ids=${ids}`).expect(200);
    expect(slugsOf(byIds)).toEqual(['sin-oferta-test']);
    await request(server).get(`${STORE}/products?ids=no-es-un-id`).expect(400);
  });

  it('las ofertas incluyen cada alcance de promoción y solo los productos con descuento real', async () => {
    const otherCategoryId = idOf(
      await owner.post(`${ADMIN}/categories`).send({ name: 'Otra Categoría Test' }).expect(201),
    );
    // Productos en la subcategoría (la promoción de la categoría principal los alcanza) y fuera.
    await createProduct('Rubor Categoria Test');
    const byVariant = await createProduct('Sombra Variante Test', { category: otherCategoryId });
    const inactive = await createProduct('Base Inactiva Test', { category: otherCategoryId });
    const fixed = await createProduct('Polvo Fijo Test', { category: otherCategoryId });
    await createProduct('Sin Promocion Test', { category: otherCategoryId });

    const period = {
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    const promotions = [
      { discountValue: 10, scope: 'CATEGORY', categoryIds: [parentId] },
      { discountValue: 20, scope: 'VARIANT', variantIds: [byVariant.variantId] },
      { discountValue: 40, scope: 'PRODUCT', productIds: [inactive.productId], isActive: false },
      {
        discountType: 'FIXED_AMOUNT',
        discountValue: 5000,
        scope: 'PRODUCT',
        productIds: [fixed.productId],
      },
    ];
    for (const [i, promotion] of promotions.entries()) {
      await owner
        .post(`${ADMIN}/promotions`)
        .send({
          name: `Promoción ficticia ${i}`,
          discountType: 'PERCENTAGE',
          ...period,
          ...promotion,
        })
        .expect(201);
    }
    // El precio baja al valor del descuento fijo: la promoción sigue vigente pero ya no aplica.
    await owner
      .patch(`${ADMIN}/products/${fixed.productId}/variants/${fixed.variantId}`)
      .send({ price: 5000 })
      .expect(200);

    const server = app.getHttpServer();
    const onSale = await request(server).get(`${STORE}/products?onSale=true`).expect(200);
    expect(slugsOf(onSale)).toEqual(['sombra-variante-test', 'rubor-categoria-test']);
    expect((onSale.body as PublicList).total).toBe(2);
    expect(
      (onSale.body as { items: Array<{ finalPriceFrom: number }> }).items[0].finalPriceFrom,
    ).toBe(8000);

    // La optimización de ofertas debe conservar el mismo precio que la ficha, incluso tras
    // cambiar el precio de la variante y generar otra entrada en su historial.
    await owner
      .patch(`${ADMIN}/products/${byVariant.productId}/variants/${byVariant.variantId}`)
      .send({ price: 12000 })
      .expect(200);
    const updatedSale = await request(server).get(`${STORE}/products?onSale=true`).expect(200);
    const detail = await request(server).get(`${STORE}/products/sombra-variante-test`).expect(200);
    expect(
      (updatedSale.body as { items: Array<{ finalPriceFrom: number }> }).items[0].finalPriceFrom,
    ).toBe(9600);
    expect((detail.body as { finalPriceFrom: number }).finalPriceFrom).toBe(9600);

    // Ofertas y búsqueda a la vez.
    const both = await request(server).get(`${STORE}/products`).query({ onSale: true, q: 'rubor' });
    expect(slugsOf(both)).toEqual(['rubor-categoria-test']);

    // La búsqueda pagina en el orden del catálogo (lo publicado más reciente primero).
    const page2 = await request(server)
      .get(`${STORE}/products`)
      .query({ q: 'TEST', limit: 2, page: 2 })
      .expect(200);
    expect(slugsOf(page2)).toEqual(['base-inactiva-test', 'sombra-variante-test']);
    expect((page2.body as PublicList).total).toBe(5);
  });
});
