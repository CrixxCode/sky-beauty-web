export interface CartLine {
  variantId: string;
  quantity: number;
}

export interface CartQuoteItem {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  quantity: number;
  /** Máximo que se puede pedir ahora (existencias y límite por pedido). */
  maxQuantity: number;
  maxPerOrder: number | null;
  issue: 'INSUFFICIENT_STOCK' | 'OVER_MAX_PER_ORDER' | null;
  unitListPrice: number;
  unitDiscount: number;
  unitFinalPrice: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTotal: number;
  promotionId: string | null;
  promotionName: string | null;
}

export interface AvailablePaymentMethod {
  id: string;
  code: string;
  name: string;
  instructions: string | null;
  requiresVerification: boolean;
}

export interface CartQuote {
  items: CartQuoteItem[];
  subtotal: number;
  discountTotal: number;
  shippingCost: number | null;
  total: number;
  freeShippingThreshold: number | null;
  shippingLabel: string;
  availablePaymentMethods: AvailablePaymentMethod[];
  unavailableVariantIds: string[];
  canCheckout: boolean;
}

export interface CreatedOrderSummary {
  items: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    unitFinalPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  discountTotal: number;
  shippingCost: number | null;
  total: number;
  shippingLabel: string;
  paymentMethodName: string;
}

export interface CreatedOrder {
  id: string;
  code: string;
  publicToken: string;
  trackingPath: string;
  whatsappMessage: string;
  whatsappUrl: string | null;
  summary: CreatedOrderSummary;
}
