import { OrderUpdateNoticeType, Prisma } from '../../generated/prisma/client';

export const ORDER_UPDATE_NAMES: Record<OrderUpdateNoticeType, string> = {
  ORDER_CONFIRMED: 'Pedido confirmado',
  PAYMENT_VERIFIED: 'Pago verificado',
  ORDER_SHIPPED: 'Pedido despachado',
};

/** Un mensaje por hito; prepararlo nunca lo marca como enviado. */
export async function prepareOrderUpdate(
  tx: Prisma.TransactionClient,
  order: { id: string; code: string; customerName: string },
  type: OrderUpdateNoticeType,
  trackingUrl: string,
  shipping?: { local: boolean; carrierName: string | null; trackingNumber: string | null },
): Promise<void> {
  const update =
    type === OrderUpdateNoticeType.ORDER_CONFIRMED
      ? 'Tu pedido {código} fue confirmado por la tienda.'
      : type === OrderUpdateNoticeType.PAYMENT_VERIFIED
        ? 'El pago de tu pedido {código} fue verificado.'
        : 'Tu pedido {código} fue despachado.';
  const delivery =
    type === OrderUpdateNoticeType.ORDER_SHIPPED && shipping
      ? shipping.local
        ? ' Entrega local de la tienda.'
        : ` Transportadora: ${shipping.carrierName ?? ''}. Guía: ${shipping.trackingNumber ?? ''}.`
      : '';
  const message = `Hola, ${order.customerName}. ${update.replace('{código}', order.code)}${delivery} Consulta el seguimiento de tu pedido: ${trackingUrl}`;
  await tx.orderUpdateNotice.createMany({
    data: [
      {
        orderId: order.id,
        type,
        message,
      },
    ],
    skipDuplicates: true,
  });
  // Una corrección de guía actualiza el borrador, conservando intacto lo que ya se envió.
  await tx.orderUpdateNotice.updateMany({
    where: { orderId: order.id, type, status: 'PENDING' },
    data: { message },
  });
}

export async function discardOrderUpdates(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  await tx.orderUpdateNotice.updateMany({
    where: { orderId, status: 'PENDING' },
    data: { status: 'DISCARDED' },
  });
}
