import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { Env } from '../../../config/env';
import { Prisma } from '../../../generated/prisma/client';
import type { AdminRole, ProductStatus } from '../../../generated/prisma/client';
import { effectiveMaxPerOrder } from '../../../shared/max-per-order';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { uploadUrl } from '../../../shared/uploads';
import { PricingService, type PriceCalculation } from '../../promotions/pricing.service';
import { escapeLike } from '../../../shared/text';
import { StoreSettingsService } from '../../store-settings/store-settings.service';
import type {
  ChangeProductStatusDto,
  CreateProductDto,
  CreateVariantDto,
  ImageDto,
  ListProductsQueryDto,
  PaginatedProductsDto,
  PaginatedPublicProductsDto,
  ProductDto,
  ProductListItemDto,
  PublicListProductsQueryDto,
  PublicProductDto,
  PublicVariantDto,
  UpdateProductDto,
  UploadProductImageDto,
  UpdateVariantDto,
  VariantDto,
} from './products.dto';

// ─────────────────────────────── Utilidades ───────────────────────────────────

/** Genera un slug a partir de un texto. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function isPrismaUniqueError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}

// ─────────────────────────────── Includes ─────────────────────────────────────

const variantInclude = {
  images: { orderBy: { position: 'asc' as const } },
};

const productInclude = {
  variants: {
    include: variantInclude,
    orderBy: { position: 'asc' as const },
  },
  images: {
    where: { variantId: null },
    orderBy: { position: 'asc' as const },
  },
};

// ─────────────────────────────── Mappers ──────────────────────────────────────

type PrismaImage = {
  id: string;
  productId: string;
  variantId: string | null;
  storageKey: string;
  thumbnailKey: string;
  alt: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  position: number;
  createdAt: Date;
};

function toImageDto(img: PrismaImage): ImageDto {
  return {
    id: img.id,
    productId: img.productId,
    variantId: img.variantId,
    storageKey: img.storageKey,
    url: uploadUrl(img.storageKey),
    thumbnailKey: img.thumbnailKey,
    thumbnailUrl: uploadUrl(img.thumbnailKey),
    alt: img.alt,
    width: img.width,
    height: img.height,
    sizeBytes: img.sizeBytes,
    mimeType: img.mimeType,
    position: img.position,
    createdAt: img.createdAt,
  };
}

type PrismaVariant = {
  id: string;
  productId: string;
  sku: string;
  name: string;
  colorHex: string | null;
  price: Prisma.Decimal | null;
  costPrice: Prisma.Decimal | null;
  maxPerOrder: number | null;
  stock: number;
  lowStockThreshold: number | null;
  isActive: boolean;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  images: PrismaImage[];
};

function toVariantDto(v: PrismaVariant, role: AdminRole): VariantDto {
  const dto: VariantDto = {
    id: v.id,
    productId: v.productId,
    sku: v.sku,
    name: v.name,
    colorHex: v.colorHex,
    price: v.price?.toNumber() ?? null,
    maxPerOrder: v.maxPerOrder,
    stock: v.stock,
    lowStockThreshold: v.lowStockThreshold,
    isActive: v.isActive,
    position: v.position,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    images: v.images.map(toImageDto),
  };
  if (role === 'ADMIN') {
    dto.costPrice = v.costPrice?.toNumber() ?? null;
  }
  return dto;
}

function toPublicVariantDto(
  v: PrismaVariant,
  pricing: PriceCalculation,
  generalMax: number | null,
): PublicVariantDto {
  return {
    id: v.id,
    sku: v.sku,
    name: v.name,
    colorHex: v.colorHex,
    price: v.price?.toNumber() ?? null,
    maxPerOrder: effectiveMaxPerOrder(v.maxPerOrder, generalMax),
    stock: v.stock,
    isActive: v.isActive,
    position: v.position,
    images: v.images.map(toImageDto),
    regularPrice: pricing.regularPrice,
    discountAmount: pricing.discountAmount,
    finalPrice: pricing.finalPrice,
    promotionId: pricing.appliedPromotion?.promotionId ?? null,
    promotionName: pricing.appliedPromotion?.promotionName ?? null,
    promotionScope: pricing.appliedPromotion?.scope ?? null,
    discountType: pricing.appliedPromotion?.discountType ?? null,
    discountValue: pricing.appliedPromotion?.discountValue ?? null,
  };
}

type PrismaProduct = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string;
  brandId: string;
  netContent: string | null;
  categoryId: string;
  basePrice: Prisma.Decimal;
  status: ProductStatus;
  isFeatured: boolean;
  publishedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  variants: PrismaVariant[];
  images: PrismaImage[];
};

function toProductDto(p: PrismaProduct, role: AdminRole): ProductDto {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription,
    description: p.description,
    brandId: p.brandId,
    netContent: p.netContent,
    categoryId: p.categoryId,
    basePrice: p.basePrice.toNumber(),
    status: p.status,
    isFeatured: p.isFeatured,
    publishedAt: p.publishedAt,
    archivedAt: p.archivedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    variants: p.variants.map((v) => toVariantDto(v, role)),
    images: p.images.map(toImageDto),
  };
}

type PriceFrom = Pick<PublicProductDto, 'regularPriceFrom' | 'finalPriceFrom' | 'hasDiscount'>;

/** Descuento del precio "desde" respecto de su precio regular (0 si no tiene). */
function discountRatio(product: PriceFrom): number {
  if (product.regularPriceFrom <= 0) return 0;
  return (product.regularPriceFrom - product.finalPriceFrom) / product.regularPriceFrom;
}

/** Precio de una variante según el motor; si no lo calculó, su precio efectivo sin descuento. */
function variantPrice(
  variant: { id: string; price: Prisma.Decimal | null },
  basePrice: Prisma.Decimal,
  priceMap: Map<string, PriceCalculation>,
): PriceCalculation {
  const fallbackPrice = (variant.price ?? basePrice).toNumber();
  return (
    priceMap.get(variant.id) ?? {
      regularPrice: fallbackPrice,
      discountAmount: 0,
      finalPrice: fallbackPrice,
      appliedPromotion: null,
    }
  );
}

/**
 * Precio "desde" de un producto a partir de los precios de sus variantes activas. El precio y su
 * precio regular salen de la misma variante (la de menor precio final), para no mostrar tachado
 * un precio de otra variante.
 */
function priceFrom(prices: PriceCalculation[], basePrice: number): PriceFrom {
  const cheapest = prices.reduce<PriceCalculation | null>(
    (best, price) => (!best || price.finalPrice < best.finalPrice ? price : best),
    null,
  );
  return {
    regularPriceFrom: cheapest?.regularPrice ?? basePrice,
    finalPriceFrom: cheapest?.finalPrice ?? basePrice,
    hasDiscount: prices.some((price) => price.discountAmount > 0),
  };
}

function toPublicProductDto(
  p: PrismaProduct,
  priceMap: Map<string, PriceCalculation>,
  generalMax: number | null,
): PublicProductDto {
  const activeVariants = p.variants.filter((v) => v.isActive);
  const prices = activeVariants.map((variant) => variantPrice(variant, p.basePrice, priceMap));
  const pricedVariants = activeVariants.map((variant, i) =>
    toPublicVariantDto(variant, prices[i], generalMax),
  );

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription,
    description: p.description,
    brandId: p.brandId,
    netContent: p.netContent,
    categoryId: p.categoryId,
    basePrice: p.basePrice.toNumber(),
    isFeatured: p.isFeatured,
    publishedAt: p.publishedAt,
    variants: pricedVariants,
    images: p.images.map(toImageDto),
    ...priceFrom(prices, p.basePrice.toNumber()),
  };
}

function toListItemDto(p: PrismaProduct & { _count: { variants: number } }): ProductListItemDto {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription,
    brandId: p.brandId,
    categoryId: p.categoryId,
    basePrice: p.basePrice.toNumber(),
    status: p.status,
    isFeatured: p.isFeatured,
    publishedAt: p.publishedAt,
    archivedAt: p.archivedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    variantCount: p._count.variants,
  };
}

// ─────────────────────────────── Servicio ─────────────────────────────────────

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeSettings: StoreSettingsService,
    private readonly pricing: PricingService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ── Listado admin ──────────────────────────────────────────────────────────

  async list(query: ListProductsQueryDto): Promise<PaginatedProductsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      // No exponemos isDemo en la API, pero filtramos para que la lista admin
      // no incluya datos de demostración del seed. Si se desea mostrarlos,
      // eliminar esta línea en el futuro. Por ahora, isDemo = false.
      // PENDIENTE: confirmar si el panel debe ver productos isDemo.
    };

    if (query.status) where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.q) {
      where.name = { contains: escapeLike(query.q), mode: 'insensitive' };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          _count: { select: { variants: true } },
          variants: { include: variantInclude, orderBy: { position: 'asc' } },
          images: { where: { variantId: null }, orderBy: { position: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((p) => toListItemDto(p as PrismaProduct & { _count: { variants: number } })),
      total,
    };
  }

  // ── Detalle admin ──────────────────────────────────────────────────────────

  async findOne(id: string, role: AdminRole): Promise<ProductDto> {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!p) throw new NotFoundException(`Producto con id '${id}' no encontrado.`);
    return toProductDto(p, role);
  }

  // ── Listado público ────────────────────────────────────────────────────────

  async listPublic(query: PublicListProductsQueryDto): Promise<PaginatedPublicProductsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = { status: 'ACTIVE' };

    if (query.brandId) where.brandId = query.brandId;
    if (query.featured) where.isFeatured = true;
    if (query.ids) where.id = { in: query.ids };

    // El filtro por categoría incluye subcategorías
    if (query.categoryId) {
      const cat = await this.prisma.category.findUnique({
        where: { id: query.categoryId },
        include: { children: true },
      });
      if (cat) {
        const categoryIds = [query.categoryId, ...cat.children.map((c) => c.id)];
        where.categoryId = { in: categoryIds };
      } else {
        where.categoryId = query.categoryId;
      }
    }

    if (query.onSale) {
      // Solo puede estar en oferta un producto que alcanza alguna promoción vigente.
      const targets = await this.pricing.promotionTargetsAt();
      const reach: Prisma.ProductWhereInput[] = [];
      if (targets.productIds.length > 0) reach.push({ id: { in: targets.productIds } });
      if (targets.variantIds.length > 0) {
        reach.push({ variants: { some: { id: { in: targets.variantIds } } } });
      }
      if (targets.categoryIds.length > 0) {
        reach.push(
          { categoryId: { in: targets.categoryIds } },
          { category: { parentId: { in: targets.categoryIds } } },
        );
      }
      if (reach.length === 0) return { items: [], total: 0 };
      where.AND = [{ OR: reach }];
    }

    if (query.q || query.onSale) {
      // Primero se decide qué productos coinciden y en qué orden, con datos mínimos; el detalle
      // completo se carga solo para la página pedida.
      const ids = query.onSale
        ? await this.onSaleIds(where, query.q)
        : await this.searchIds(where, query.q ?? '');
      const items = await this.findPublicByIds(ids.slice(skip, skip + limit));
      const priceMap = await this.priceProducts(items);
      const generalMax = await this.generalMaxPerOrder();
      return {
        items: items.map((p) => toPublicProductDto(p, priceMap, generalMax)),
        total: ids.length,
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const priceMap = await this.priceProducts(items);
    const generalMax = await this.generalMaxPerOrder();
    return {
      items: items.map((p) => toPublicProductDto(p as PrismaProduct, priceMap, generalMax)),
      total,
    };
  }

  /**
   * Productos cuyo nombre contiene el texto buscado, sin distinguir mayúsculas ni tildes. Se
   * compara en memoria (la base no ignora tildes), pero solo con el id y el nombre.
   */
  private async searchIds(where: Prisma.ProductWhereInput, q: string): Promise<string[]> {
    const needle = normalizeSearchText(q);
    const candidates = await this.prisma.product.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { publishedAt: 'desc' },
    });
    return candidates
      .filter((product) => normalizeSearchText(product.name).includes(needle))
      .map((product) => product.id);
  }

  /**
   * Productos con descuento, primero el mayor. Saber si un producto está en oferta exige calcular
   * sus precios con las promociones vigentes, así que se calculan con lo mínimo de cada variante.
   */
  private async onSaleIds(where: Prisma.ProductWhereInput, q?: string): Promise<string[]> {
    const needle = q ? normalizeSearchText(q) : null;
    const candidates = (
      await this.prisma.product.findMany({
        where,
        select: {
          id: true,
          name: true,
          basePrice: true,
          categoryId: true,
          category: { select: { parentId: true } },
          variants: {
            where: { isActive: true },
            orderBy: { position: 'asc' },
            select: { id: true, price: true },
          },
        },
        orderBy: { publishedAt: 'desc' },
      })
    ).filter((product) => !needle || normalizeSearchText(product.name).includes(needle));

    // Las variantes ya están leídas: el motor no las vuelve a consultar.
    const priceMap = await this.pricing.priceKnownVariantsNow(
      candidates.flatMap((product) =>
        product.variants.map((variant) => ({
          variantId: variant.id,
          productId: product.id,
          categoryId: product.categoryId,
          parentCategoryId: product.category.parentId,
          currentPrice: (variant.price ?? product.basePrice).toNumber(),
        })),
      ),
    );
    return candidates
      .map((product) => ({
        id: product.id,
        ...priceFrom(
          product.variants.map((variant) => variantPrice(variant, product.basePrice, priceMap)),
          product.basePrice.toNumber(),
        ),
      }))
      .filter((product) => product.hasDiscount)
      .sort((a, b) => discountRatio(b) - discountRatio(a))
      .map((product) => product.id);
  }

  /** Productos activos con su detalle público, en el orden de `ids`. */
  private async findPublicByIds(ids: string[]): Promise<PrismaProduct[]> {
    if (ids.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      include: productInclude,
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  /** Precios vigentes de las variantes activas de varios productos, en una sola consulta al motor. */
  private priceProducts(
    products: Array<{ variants: Array<{ id: string; isActive: boolean }> }>,
  ): Promise<Map<string, PriceCalculation>> {
    return this.pricing.priceVariantsAt(
      products.flatMap((p) => p.variants.filter((v) => v.isActive).map((v) => v.id)),
    );
  }

  // ── Detalle público por slug ───────────────────────────────────────────────

  async findOnePublicBySlug(slug: string): Promise<PublicProductDto> {
    const p = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: productInclude,
    });
    if (!p) throw new NotFoundException(`Producto '${slug}' no encontrado.`);
    return toPublicProductDto(p, await this.priceProducts([p]), await this.generalMaxPerOrder());
  }

  private async generalMaxPerOrder(): Promise<number | null> {
    return (await this.storeSettings.get()).maxUnitsPerProduct;
  }

  // ── Crear producto ─────────────────────────────────────────────────────────

  async create(dto: CreateProductDto, adminId: string, role: AdminRole): Promise<ProductDto> {
    await this.validateCategoryForProduct(dto.categoryId);

    const slug = dto.slug ?? slugify(dto.name);
    try {
      const p = await this.prisma.product.create({
        data: {
          name: dto.name,
          slug,
          shortDescription: dto.shortDescription ?? null,
          description: dto.description,
          brandId: dto.brandId,
          netContent: dto.netContent ?? null,
          categoryId: dto.categoryId,
          basePrice: dto.basePrice,
          isFeatured: dto.isFeatured ?? false,
          status: 'DRAFT',
        },
        include: productInclude,
      });
      return toProductDto(p, role);
    } catch (err: unknown) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException('Ya existe un producto con ese slug.');
      }
      throw err;
    }
  }

  // ── Actualizar producto ────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateProductDto,
    adminId: string,
    role: AdminRole,
  ): Promise<ProductDto> {
    const existing = await this.findProductOrThrow(id);

    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      await this.validateCategoryForProduct(dto.categoryId);
    }

    const slug =
      dto.slug !== undefined ? dto.slug : dto.name !== undefined ? slugify(dto.name) : undefined;

    try {
      const p = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.product.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(slug !== undefined && { slug }),
            ...(dto.shortDescription !== undefined && { shortDescription: dto.shortDescription }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.brandId !== undefined && { brandId: dto.brandId }),
            ...(dto.netContent !== undefined && { netContent: dto.netContent }),
            ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
            ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
            ...(dto.isFeatured !== undefined && { isFeatured: dto.isFeatured }),
          },
          include: productInclude,
        });

        // Si cambió basePrice, registrar en VariantPriceHistory para variantes sin precio propio
        if (dto.basePrice !== undefined && dto.basePrice !== existing.basePrice.toNumber()) {
          const variantsWithoutPrice = updated.variants.filter((v) => v.price === null);
          for (const v of variantsWithoutPrice) {
            await this.recordPriceHistory(tx, v.id, dto.basePrice, adminId);
          }
        }

        return updated;
      });

      return toProductDto(p, role);
    } catch (err: unknown) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException('Ya existe un producto con ese slug.');
      }
      throw err;
    }
  }

  // ── Cambiar estado ─────────────────────────────────────────────────────────

  async changeStatus(
    id: string,
    dto: ChangeProductStatusDto,
    adminId: string,
    role: AdminRole,
  ): Promise<ProductDto> {
    const existing = await this.findProductOrThrow(id);

    const now = new Date();
    const data: Prisma.ProductUpdateInput = { status: dto.status };

    if (dto.status === 'ACTIVE' && !existing.publishedAt) {
      // Solo se registra la primera vez que se publica
      data.publishedAt = now;
    } else if (dto.status === 'ARCHIVED' && !existing.archivedAt) {
      data.archivedAt = now;
    }

    const p = await this.prisma.product.update({
      where: { id },
      data,
      include: productInclude,
    });

    return toProductDto(p, role);
  }

  // ── Eliminar producto ──────────────────────────────────────────────────────

  async remove(id: string): Promise<void> {
    await this.findProductOrThrow(id);

    const orderItemCount = await this.prisma.orderItem.count({
      where: { productId: id },
    });
    if (orderItemCount > 0) {
      throw new ConflictException(
        'El producto tiene pedidos asociados y no puede eliminarse. Archívalo en su lugar.',
      );
    }
    // El historial de inventario no se borra (Context/negocio.md: todo movimiento queda registrado).
    const movementCount = await this.prisma.inventoryMovement.count({
      where: { variant: { productId: id } },
    });
    if (movementCount > 0) {
      throw new ConflictException(
        'El producto tiene movimientos de inventario registrados y no puede eliminarse. Archívalo en su lugar.',
      );
    }

    // Las variantes no se borran solas con el producto (la relación lo impide a propósito).
    await this.prisma.$transaction([
      this.prisma.productVariant.deleteMany({ where: { productId: id } }),
      this.prisma.product.delete({ where: { id } }),
    ]);
    await rm(join(this.uploadsDir(), 'products', id), { recursive: true, force: true });
  }

  // ── Crear variante ─────────────────────────────────────────────────────────

  async createVariant(
    productId: string,
    dto: CreateVariantDto,
    adminId: string,
    role: AdminRole,
  ): Promise<VariantDto> {
    await this.findProductOrThrow(productId);

    // Proponer lowStockThreshold del StoreSettings si no se indica
    let lowStockThreshold = dto.lowStockThreshold;
    if (lowStockThreshold === undefined) {
      const settings = await this.storeSettings.get();
      lowStockThreshold = settings.defaultLowStockThreshold ?? undefined;
    }

    // Solo ADMIN puede establecer costPrice
    const costPrice = role === 'ADMIN' ? (dto.costPrice ?? null) : null;

    try {
      const variant = await this.prisma.$transaction(async (tx) => {
        const created = await tx.productVariant.create({
          data: {
            productId,
            sku: dto.sku,
            name: dto.name,
            colorHex: dto.colorHex ?? null,
            price: dto.price ?? null,
            costPrice,
            maxPerOrder: dto.maxPerOrder ?? null,
            lowStockThreshold: lowStockThreshold ?? null,
          },
          include: variantInclude,
        });

        // Registrar precio inicial en VariantPriceHistory
        const product = await tx.product.findUniqueOrThrow({
          where: { id: productId },
          select: { basePrice: true },
        });
        const effectivePrice =
          created.price !== null ? created.price.toNumber() : product.basePrice.toNumber();
        await this.recordPriceHistory(tx, created.id, effectivePrice, adminId);

        return created;
      });

      return toVariantDto(variant, role);
    } catch (err: unknown) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException('Ya existe una variante con ese SKU.');
      }
      throw err;
    }
  }

  // ── Actualizar variante ────────────────────────────────────────────────────

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateVariantDto,
    adminId: string,
    role: AdminRole,
  ): Promise<VariantDto> {
    const variant = await this.findVariantOrThrow(productId, variantId);

    // Solo ADMIN puede cambiar costPrice
    const costPrice = role === 'ADMIN' && 'costPrice' in dto ? dto.costPrice : undefined;

    const variant2 = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...('colorHex' in dto && { colorHex: dto.colorHex ?? null }),
          ...('price' in dto && { price: dto.price ?? null }),
          ...(costPrice !== undefined && { costPrice: costPrice ?? null }),
          ...('maxPerOrder' in dto && { maxPerOrder: dto.maxPerOrder ?? null }),
          ...('lowStockThreshold' in dto && { lowStockThreshold: dto.lowStockThreshold ?? null }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        include: variantInclude,
      });

      // Si cambió price, registrar en VariantPriceHistory
      if ('price' in dto) {
        const oldPriceNum = variant.price?.toNumber() ?? null;
        const newPriceNum = dto.price ?? null;
        if (oldPriceNum !== newPriceNum) {
          // El precio efectivo puede ser el nuevo price o el basePrice del producto
          let effectivePrice: number;
          if (newPriceNum !== null) {
            effectivePrice = newPriceNum;
          } else {
            const product = await tx.product.findUniqueOrThrow({
              where: { id: productId },
              select: { basePrice: true },
            });
            effectivePrice = product.basePrice.toNumber();
          }
          await this.recordPriceHistory(tx, variantId, effectivePrice, adminId);
        }
      }

      return updated;
    });

    return toVariantDto(variant2, role);
  }

  // ── Eliminar variante ──────────────────────────────────────────────────────

  async removeVariant(productId: string, variantId: string): Promise<void> {
    await this.findVariantOrThrow(productId, variantId);

    const orderItemCount = await this.prisma.orderItem.count({ where: { variantId } });
    if (orderItemCount > 0) {
      throw new ConflictException(
        'La variante tiene pedidos asociados y no puede eliminarse. Desactívala en su lugar.',
      );
    }
    const movementCount = await this.prisma.inventoryMovement.count({ where: { variantId } });
    if (movementCount > 0) {
      throw new ConflictException(
        'La variante tiene movimientos de inventario registrados y no puede eliminarse. Desactívala en su lugar.',
      );
    }

    const images = await this.prisma.productImage.findMany({ where: { variantId } });
    await this.prisma.productVariant.delete({ where: { id: variantId } });
    await this.removeImageFiles(images);
  }

  // ── Imágenes ───────────────────────────────────────────────────────────────

  async uploadImage(
    productId: string,
    dto: UploadProductImageDto,
    file: Express.Multer.File,
    maxImageSizeMb: number,
  ): Promise<ImageDto> {
    await this.findProductOrThrow(productId);

    if (!file?.buffer?.length) {
      throw new BadRequestException('Debes adjuntar una imagen.');
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException('Solo se aceptan imágenes JPG, PNG o WebP.');
    }

    if (file.size > maxImageSizeMb * 1024 * 1024) {
      throw new BadRequestException(`La imagen no puede superar ${maxImageSizeMb} MB.`);
    }

    if (dto.variantId) {
      await this.findVariantOrThrow(productId, dto.variantId);
    }

    const uploadsDir = this.uploadsDir();
    const productDir = join('products', productId);
    const absoluteProductDir = join(uploadsDir, productDir);
    const absoluteThumbDir = join(absoluteProductDir, 'thumbs');
    await mkdir(absoluteProductDir, { recursive: true });
    await mkdir(absoluteThumbDir, { recursive: true });

    const id = randomUUID();
    const storageKey = join(productDir, `${id}.webp`).replace(/\\/g, '/');
    const thumbnailKey = join(productDir, 'thumbs', `${id}.webp`).replace(/\\/g, '/');
    const absoluteImagePath = join(uploadsDir, storageKey);
    const absoluteThumbPath = join(uploadsDir, thumbnailKey);

    let imageInfo: sharp.OutputInfo;
    try {
      const image = sharp(file.buffer).rotate();
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height) {
        throw new BadRequestException('El archivo no parece ser una imagen válida.');
      }

      imageInfo = await image
        .clone()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86 })
        .toFile(absoluteImagePath);

      await image
        .clone()
        .resize({ width: 420, height: 420, fit: 'cover' })
        .webp({ quality: 78 })
        .toFile(absoluteThumbPath);
    } catch (error) {
      // Un archivo dañado, que no es imagen o con dimensiones excesivas (por ejemplo, una
      // "bomba de descompresión") es un error del archivo enviado, no del servidor.
      await Promise.allSettled([
        rm(absoluteImagePath, { force: true }),
        rm(absoluteThumbPath, { force: true }),
      ]);
      if (error instanceof BadRequestException) throw error;
      const message = error instanceof Error ? error.message : '';
      throw new BadRequestException(
        /pixel limit/i.test(message)
          ? 'La imagen tiene dimensiones demasiado grandes. Usa una de menos de 16.000 píxeles por lado.'
          : 'El archivo no parece ser una imagen válida.',
      );
    }

    const saved = await this.prisma.productImage.create({
      data: {
        productId,
        variantId: dto.variantId ?? null,
        storageKey,
        thumbnailKey,
        alt: dto.alt?.trim() ?? '',
        width: imageInfo.width,
        height: imageInfo.height,
        sizeBytes: file.size,
        mimeType: 'image/webp',
        position: dto.position ?? 0,
      },
    });

    return toImageDto(saved);
  }

  async removeImage(productId: string, imageId: string): Promise<void> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException(`Imagen con id '${imageId}' no encontrada.`);

    await this.prisma.productImage.delete({ where: { id: imageId } });
    await this.removeImageFiles([image]);
  }

  private uploadsDir(): string {
    return resolve(this.config.get('UPLOADS_DIR', { infer: true }));
  }

  /** Borra del disco los archivos de fotos ya eliminadas de la base de datos. */
  private async removeImageFiles(
    images: Array<{ storageKey: string; thumbnailKey: string }>,
  ): Promise<void> {
    const dir = this.uploadsDir();
    await Promise.allSettled(
      images.flatMap((image) => [
        rm(join(dir, image.storageKey), { force: true }),
        rm(join(dir, image.thumbnailKey), { force: true }),
      ]),
    );
  }

  // ── Helpers privados ───────────────────────────────────────────────────────

  /** Registra un cambio de precio efectivo en VariantPriceHistory. */
  private async recordPriceHistory(
    tx: Prisma.TransactionClient,
    variantId: string,
    price: number,
    changedById: string,
  ): Promise<void> {
    await tx.variantPriceHistory.create({
      data: { variantId, price, changedById },
    });
  }

  /** Lanza NotFoundException si el producto no existe. */
  private async findProductOrThrow(id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        categoryId: true,
        basePrice: true,
        status: true,
        publishedAt: true,
        archivedAt: true,
      },
    });
    if (!p) throw new NotFoundException(`Producto con id '${id}' no encontrado.`);
    return p;
  }

  /** Lanza NotFoundException si la variante no existe o no pertenece al producto. */
  private async findVariantOrThrow(productId: string, variantId: string) {
    const v = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!v) throw new NotFoundException(`Variante con id '${variantId}' no encontrada.`);
    return v;
  }

  /**
   * Valida que categoryId sea una categoría hoja (sin hijos) o una categoría raíz sin subcategorías.
   * Un producto NO puede ir en una categoría que tenga subcategorías.
   */
  private async validateCategoryForProduct(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { children: true } } },
    });
    if (!category) {
      throw new NotFoundException(`Categoría con id '${categoryId}' no encontrada.`);
    }
    if (category._count.children > 0) {
      throw new BadRequestException(
        'No se puede asignar un producto a una categoría que tiene subcategorías. ' +
          'Elige una subcategoría o una categoría sin subcategorías.',
      );
    }
  }
}
