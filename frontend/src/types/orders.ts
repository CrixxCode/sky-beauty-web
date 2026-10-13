import type { OrderStatus, PaymentStatus } from './orders-labels';
import type { AdminShipping } from './shipping';

export interface AdminOrderItem {
  id: string;
  variantId: string | null;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  unitListPrice: number;
  unitDiscount: number;
  unitFinalPrice: number;
  unitCost: number | null;
  quantity: number;
  lineTotal: number;
  promotionId: string | null;
  promotionName: string | null;
  createdAt: string;
}

export interface AdminOrderEvent {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  changedById: string | null;
  createdAt: string;
}

export interface AdminPaymentRecord {
  id: string;
  status: PaymentStatus;
  amount: number;
  reference: string | null;
  note: string | null;
  recordedById: string | null;
  createdAt: string;
}

export interface AdminOrderListItem {
  id: string;
  code: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  customerPhone: string;
  city: string;
  department: string;
  paymentMethodName: string;
  subtotal: number;
  discountTotal: number;
  shippingCost: number | null;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrder extends AdminOrderListItem {
  municipalityCode: string;
  addressLine: string;
  deliveryNotes: string | null;
  paymentMethodCode: string;
  confirmedAt: string | null;
  /** Enlace privado de seguimiento del cliente, para reenviárselo. */
  trackingUrl: string;
  paymentRejectedAt: string | null;
  /** Fin del plazo de aclaración de un pago rechazado. */
  paymentClarificationDeadline: string | null;
  /** El personal ya puede cancelar por pago no demostrado. */
  staffCanCancel: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: AdminOrderItem[];
  events: AdminOrderEvent[];
  paymentRecords: AdminPaymentRecord[];
  shipping: AdminShipping | null;
}

export interface PaginatedAdminOrders {
  items: AdminOrderListItem[];
  total: number;
}
