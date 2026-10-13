import type { OrderStatus, PaymentStatus } from './orders-labels';
import type { ShippingMethod, ShippingStatus } from './shipping';

export interface PublicTrackingShipping {
  method: ShippingMethod;
  status: ShippingStatus;
  carrierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
}

export interface PublicTrackingItem {
  productName: string;
  variantName: string;
  quantity: number;
  unitFinalPrice: number;
  lineTotal: number;
}

export interface PublicOrderTracking {
  code: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethodName: string;
  items: PublicTrackingItem[];
  subtotal: number;
  discountTotal: number;
  shippingCost: number | null;
  total: number;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  shipping: PublicTrackingShipping | null;
}
