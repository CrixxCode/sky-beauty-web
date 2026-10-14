/**
 * Borra los datos de demostración que cargó seed-demo (ver demo-common.ts para cómo se
 * identifican) y sus fotos en UPLOADS_DIR. No toca los datos reales: solo pedidos que contienen
 * productos de demostración, y marcas o categorías "Demo" que se quedan sin otros productos.
 *
 * Uso (desde backend/): npm run db:demo:clean
 */
import 'dotenv/config';
import { rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  DEMO_ADMIN_EMAIL,
  DEMO_CARRIER,
  DEMO_PHONE_PREFIX,
  DEMO_PREFIX,
  demoPrisma,
} from './demo-common';

async function main(): Promise<void> {
  const prisma = demoPrisma();
  try {
    const products = await prisma.product.findMany({
      where: { isDemo: true },
      select: { id: true, images: { select: { storageKey: true, thumbnailKey: true } } },
    });
    const productIds = products.map((product) => product.id);
    const variantIds = (
      await prisma.productVariant.findMany({
        where: { productId: { in: productIds } },
        select: { id: true },
      })
    ).map((variant) => variant.id);

    // Pedidos con productos de demostración (y sus movimientos de inventario).
    const orderIds = [
      ...new Set(
        (
          await prisma.orderItem.findMany({
            where: { productId: { in: productIds } },
            select: { orderId: true },
          })
        ).map((item) => item.orderId),
      ),
    ];

    const result = await prisma.$transaction(async (tx) => {
      await tx.inventoryMovement.deleteMany({
        where: { OR: [{ orderId: { in: orderIds } }, { variantId: { in: variantIds } }] },
      });
      const orders = await tx.order.deleteMany({ where: { id: { in: orderIds } } });
      const customers = await tx.customer.deleteMany({
        where: { phone: { startsWith: DEMO_PHONE_PREFIX }, orders: { none: {} } },
      });
      const promotions = await tx.promotion.deleteMany({
        where: { name: { startsWith: DEMO_PREFIX } },
      });
      const testimonials = await tx.testimonial.deleteMany({
        where: {
          OR: [{ firstName: { startsWith: DEMO_PREFIX } }, { productId: { in: productIds } }],
        },
      });
      await tx.productVariant.deleteMany({ where: { id: { in: variantIds } } });
      const deletedProducts = await tx.product.deleteMany({ where: { id: { in: productIds } } });
      // Subcategorías primero; solo las que quedaron sin productos.
      await tx.category.deleteMany({
        where: {
          name: { startsWith: DEMO_PREFIX },
          parentId: { not: null },
          products: { none: {} },
        },
      });
      await tx.category.deleteMany({
        where: {
          name: { startsWith: DEMO_PREFIX },
          products: { none: {} },
          children: { none: {} },
        },
      });
      await tx.brand.deleteMany({
        where: { name: { startsWith: DEMO_PREFIX }, products: { none: {} } },
      });
      await tx.carrier.deleteMany({ where: { name: DEMO_CARRIER, shippings: { none: {} } } });
      await tx.adminUser.deleteMany({ where: { email: DEMO_ADMIN_EMAIL } });
      return {
        orders: orders.count,
        customers: customers.count,
        promotions: promotions.count,
        testimonials: testimonials.count,
        products: deletedProducts.count,
      };
    });

    // Fotos en disco (después de borrar las filas, para no dejar productos sin foto).
    const uploads = resolve(process.env.UPLOADS_DIR ?? './uploads');
    for (const image of products.flatMap((product) => product.images)) {
      await rm(join(uploads, image.storageKey), { force: true });
      await rm(join(uploads, image.thumbnailKey), { force: true });
    }

    console.log(
      `Datos de demostración borrados: ${result.products} productos, ${result.orders} pedidos, ` +
        `${result.customers} clientes, ${result.promotions} promociones y ` +
        `${result.testimonials} testimonios.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
