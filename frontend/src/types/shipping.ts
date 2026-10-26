export type ShippingStatus = 'NOT_SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'INCIDENT';

/** Por transportadora (con guía) o entrega local de la tienda (decisión del 2026-10-13). */
export type ShippingMethod = 'CARRIER' | 'LOCAL';

export const SHIPPING_METHOD_LABELS: Record<ShippingMethod, string> = {
  CARRIER: 'Por transportadora',
  LOCAL: 'Entrega local',
};

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

/** Lo que se le cobra al cliente al enviar con una transportadora a un municipio. */
export interface CarrierRate {
  id: string;
  carrierId: string;
  municipalityCode: string;
  municipalityName: string;
  departmentName: string;
  amount: number;
}

/** Envío que se propone al elegir una transportadora en un pedido sin confirmar. */
export interface ShippingQuote {
  carrierId: string;
  carrierName: string;
  municipalityName: string;
  source: 'FREE' | 'CARRIER_RATE' | 'NO_RATE';
  shippingCost: number | null;
}

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
  method: ShippingMethod;
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
