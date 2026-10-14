export type ReportGrouping = 'day' | 'week' | 'month';

export interface SalesReport {
  summary: {
    orders: number;
    productsRevenue: number;
    discounts: number;
    shippingCharged: number;
    total: number;
    averageTicket: number;
  };
  series: Array<{ period: string; orders: number; productsRevenue: number; total: number }>;
}

export interface TopProduct {
  productName: string;
  variantName: string;
  sku: string;
  units: number;
  revenue: number;
}

export interface ProductMargin extends TopProduct {
  cost: number;
  profit: number;
  marginPct: number;
}

export interface MarginsReport {
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  unitsWithoutCost: number;
  revenueWithoutCost: number;
  shippingCharged: number;
  shippingCarrierCost: number;
  byProduct: ProductMargin[];
}
