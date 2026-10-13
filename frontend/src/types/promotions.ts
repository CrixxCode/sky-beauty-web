export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type PromotionScope = 'VARIANT' | 'PRODUCT' | 'CATEGORY';

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  scope: PromotionScope;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  variantIds: string[];
  productIds: string[];
  categoryIds: string[];
  revisionCount: number;
}

export interface PaginatedPromotions {
  items: Promotion[];
  total: number;
}

export interface PromotionRevision {
  id: string;
  promotionId: string;
  revision: number;
  validFrom: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  scope: PromotionScope;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  variantIds: string[];
  productIds: string[];
  categoryIds: string[];
  changedById: string | null;
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  PERCENTAGE: 'Porcentaje',
  FIXED_AMOUNT: 'Importe fijo',
};

export const PROMOTION_SCOPE_LABELS: Record<PromotionScope, string> = {
  VARIANT: 'Variantes',
  PRODUCT: 'Productos',
  CATEGORY: 'Categorias',
};
