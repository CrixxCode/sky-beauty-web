/** Catálogo exclusivamente ficticio para medir BE-227/BE-228 en una base *_test vacía. */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { assertTestDatabaseUrl } from '../src/shared/security/test-database-url';
import { seed } from '../prisma/seed';

async function main() {
  const url = process.env.PERF_DATABASE_URL;
  assertTestDatabaseUrl(url);
  const count = Number(process.argv[2] ?? 2000);
  if (!Number.isInteger(count) || count < 1 || count > 10000)
    throw new Error('Usa entre 1 y 10000 productos ficticios.');
  const prisma = new PrismaClient({ adapter: new PrismaPg(url) });
  try {
    if ((await prisma.product.count()) || (await prisma.order.count()))
      throw new Error('La base debe estar vacía de productos y pedidos. No se borró nada.');
    await seed(prisma);
    const brand = await prisma.brand.create({
      data: { name: 'Marca ficticia de carga QA', slug: 'marca-ficticia-carga-qa' },
    });
    const category = await prisma.category.create({
      data: { name: 'Categoría ficticia de carga QA', slug: 'categoria-ficticia-carga-qa' },
    });
    const at = new Date(Date.now() - 3600000);
    const products = Array.from({ length: count }, (_, i) => ({
      id: randomUUID(),
      name: `Producto ficticio QA ${i}`,
      slug: `producto-ficticio-qa-${i}`,
      description: 'Dato ficticio exclusivo de pruebas de carga.',
      basePrice: 20000,
      categoryId: category.id,
      brandId: brand.id,
      status: 'ACTIVE' as const,
      publishedAt: at,
    }));
    await prisma.product.createMany({ data: products });
    const variants = products.flatMap((p, i) =>
      Array.from({ length: 3 }, (_, j) => ({
        id: randomUUID(),
        productId: p.id,
        sku: `QA-FICTICIO-${i}-${j}`,
        name: `Variante ficticia ${j}`,
        stock: 50,
        position: j,
      })),
    );
    await prisma.productVariant.createMany({ data: variants });
    await prisma.variantPriceHistory.createMany({
      data: variants.map((v) => ({ variantId: v.id, price: 20000, validFrom: at })),
    });
    await prisma.inventoryMovement.createMany({
      data: variants.map((v) => ({
        variantId: v.id,
        type: 'INITIAL' as const,
        quantity: 50,
        stockBefore: 0,
        stockAfter: 50,
        reason: 'Existencias ficticias de carga QA.',
      })),
    });
    for (let i = 0; i < 30; i++) {
      await prisma.promotion.create({
        data: {
          name: `Promoción ficticia QA ${i}`,
          discountType: 'PERCENTAGE',
          discountValue: i + 1,
          scope: 'CATEGORY',
          startsAt: at,
          endsAt: new Date(Date.now() + 86400000),
          createdAt: at,
          categories: { create: { categoryId: category.id } },
          revisions: {
            create: {
              revision: 1,
              validFrom: at,
              name: `Promoción ficticia QA ${i}`,
              discountType: 'PERCENTAGE',
              discountValue: i + 1,
              scope: 'CATEGORY',
              startsAt: at,
              endsAt: new Date(Date.now() + 86400000),
              isActive: true,
              categoryIds: [category.id],
              productIds: [],
              variantIds: [],
            },
          },
        },
      });
    }
    console.log(JSON.stringify({ products: count, variants: variants.length, promotions: 30 }));
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo preparar la carga.');
  process.exitCode = 1;
});
