export type InventoryMovementType =
  | 'INITIAL'
  | 'PURCHASE'
  | 'ADJUSTMENT'
  | 'ORDER_RESERVED'
  | 'ORDER_RELEASED'
  | 'RETURN';

export const INVENTORY_MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  INITIAL: 'Existencias iniciales',
  PURCHASE: 'Compra a proveedor',
  ADJUSTMENT: 'Ajuste manual',
  ORDER_RESERVED: 'Reserva por pedido',
  ORDER_RELEASED: 'Liberación por pedido',
  RETURN: 'Devolución',
};

export interface InventoryVariant {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  sku: string;
  stock: number;
  lowStockThreshold: number | null;
  isLowStock: boolean;
  isActive: boolean;
  thumbnailUrl: string | null;
}

export interface InventoryMovement {
  id: string;
  variantId: string;
  type: InventoryMovementType;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  orderId: string | null;
  createdById: string | null;
  createdByName: string | null;
  productName: string;
  variantName: string;
  sku: string;
  createdAt: string;
}

export interface PaginatedInventoryMovements {
  items: InventoryMovement[];
  total: number;
}
