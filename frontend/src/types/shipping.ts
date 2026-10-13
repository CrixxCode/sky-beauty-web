export type ShippingStatus = 'NOT_SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'INCIDENT';

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  NOT_SHIPPED: 'Sin despachar',
  IN_TRANSIT: 'En transito',
  DELIVERED: 'Entregado',
  INCIDENT: 'Incidencia',
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
