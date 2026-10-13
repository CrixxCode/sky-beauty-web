export type ShippingStatus = 'NOT_SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'INCIDENT';

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  NOT_SHIPPED: 'Sin despachar',
  IN_TRANSIT: 'En tránsito',
  DELIVERED: 'Entregado',
  INCIDENT: 'Con novedad',
};

/** Avance permitido del envío (igual que el backend). Un envío entregado no cambia de estado. */
export const NEXT_SHIPPING_STATUSES: Record<ShippingStatus, ShippingStatus[]> = {
  NOT_SHIPPED: ['NOT_SHIPPED', 'IN_TRANSIT', 'DELIVERED'],
  IN_TRANSIT: ['IN_TRANSIT', 'INCIDENT', 'DELIVERED'],
  INCIDENT: ['INCIDENT', 'IN_TRANSIT', 'DELIVERED'],
  DELIVERED: ['DELIVERED'],
};

export interface Carrier {
  id: string;
  name: string;
  trackingUrlTemplate: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminShipping {
  id: string;
  carrierId: string | null;
  carrierName: string | null;
  carrierTrackingUrlTemplate: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrierCost: number | null;
  status: ShippingStatus;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}
