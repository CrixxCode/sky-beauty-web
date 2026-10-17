import { AdminNotificationType, Prisma } from '../../generated/prisma/client';

/** Se llama después de modificar el stock, dentro de la misma transacción que bloquea la variante. */
export async function notifyStockTransition(
  tx: Prisma.TransactionClient,
  variantId: string,
  before: number,
  after: number,
): Promise<void> {
  if (after >= before) return;
  const variant = await tx.productVariant.findUniqueOrThrow({
    where: { id: variantId },
    select: { name: true, sku: true, lowStockThreshold: true, product: { select: { name: true } } },
  });
  const depleted = before > 0 && after === 0;
  const low =
    variant.lowStockThreshold !== null &&
    before > variant.lowStockThreshold &&
    after <= variant.lowStockThreshold;
  if (!depleted && !low) return;
  await tx.adminNotification.create({
    data: {
      type: depleted ? AdminNotificationType.OUT_OF_STOCK : AdminNotificationType.LOW_STOCK,
      title: `${depleted ? 'Agotado' : 'Stock bajo'}: ${variant.product.name} · ${variant.name}`,
      body: `SKU ${variant.sku}. Existencias disponibles: ${after}. Revisa el inventario.`,
    },
  });
}
