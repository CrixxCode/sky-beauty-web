import type { OrderStatus, PaymentStatus } from './orders-labels';
import type { ShippingStatus } from './shipping';

export interface PublicTrackingShipping {
  status: ShippingStatus;
  carrierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
}

export interface PublicOrderTracking {
  code: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethodName: string;
  shippingCost: number | null;
  total: number;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  shipping: PublicTrackingShipping | null;
}
