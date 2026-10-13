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
  stock: number;
  maxPerOrder: number | null;
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
}

export interface CreatedOrder {
  id: string;
  code: string;
  publicToken: string;
  trackingPath: string;
  whatsappMessage: string;
  whatsappUrl: string | null;
  quote: CartQuote;
}
