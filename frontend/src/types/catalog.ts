export interface Brand {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  imageUrl: string | null;
  position: number;
  isActive: boolean;
  children: Category[];
  createdAt: string;
  updatedAt: string;
}

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ARCHIVED: 'Archivado',
};

export interface ProductImage {
  id: string;
  productId: string;
  variantId: string | null;
  storageKey: string;
  url: string;
  thumbnailKey: string;
  thumbnailUrl: string;
  alt: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  position: number;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  colorHex: string | null;
  price: number | null;
  costPrice?: number | null; // Solo visible para ADMIN
  maxPerOrder: number | null;
  stock: number;
  lowStockThreshold: number | null;
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[];
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  brandId: string;
  categoryId: string;
  basePrice: number;
  status: ProductStatus;
  isFeatured: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  variantCount: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  brandId: string;
  netContent: string | null;
  categoryId: string;
  basePrice: number;
  status: ProductStatus;
  isFeatured: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  variants: ProductVariant[];
  images: ProductImage[];
}

export interface PaginatedProducts {
  items: ProductListItem[];
  total: number;
}

export interface PublicBrand {
  id: string;
  name: string;
  slug: string;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: PublicCategory[];
}

export interface PublicVariant {
  id: string;
  sku: string;
  name: string;
  colorHex: string | null;
  price: number | null;
  maxPerOrder: number | null;
  stock: number;
  isActive: boolean;
  position: number;
  images: ProductImage[];
  regularPrice: number;
  discountAmount: number;
  finalPrice: number;
  promotionId: string | null;
  promotionName: string | null;
  promotionScope: 'VARIANT' | 'PRODUCT' | 'CATEGORY' | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | null;
  discountValue: number | null;
}

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  brandId: string;
  netContent: string | null;
  categoryId: string;
  basePrice: number;
  isFeatured: boolean;
  publishedAt: string | null;
  variants: PublicVariant[];
  images: ProductImage[];
  regularPriceFrom: number;
  finalPriceFrom: number;
  hasDiscount: boolean;
}

export interface PaginatedPublicProducts {
  items: PublicProduct[];
  total: number;
}
