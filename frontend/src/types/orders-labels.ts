export type OrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'AWAITING_VERIFICATION' | 'PAID' | 'REJECTED' | 'REFUNDED';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'Sin confirmar',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  SHIPPED: 'Despachado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Sin comprobante',
  AWAITING_VERIFICATION: 'Por verificar',
  PAID: 'Pagado',
  REJECTED: 'Rechazado',
  REFUNDED: 'Devuelto',
};

/**
 * Estados a los que se puede pasar desde "cambiar estado" (igual que el backend): solo marcar en
 * preparación. Confirmar y cancelar tienen sus propias acciones; despachar y entregar se registran
 * en el envío.
 */
export const NEXT_ORDER_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING_CONFIRMATION: [],
  CONFIRMED: ['PREPARING'],
  PREPARING: [],
  SHIPPED: [],
  DELIVERED: [],
  CANCELLED: [],
};

export const ORDER_EVENT_LABELS: Record<string, string> = {
  ITEMS_CHANGED: 'Productos editados',
  PAYMENT_STATUS: 'Pago',
  SHIPPING: 'Envío',
  NOTE: 'Nota',
};
