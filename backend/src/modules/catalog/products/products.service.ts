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
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { PricingService, type PriceCalculation } from '../../promotions/pricing.service';
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
  url: string;
  thumbnailKey: string;
  thumbnailUrl: string;
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
    url: img.url,
    thumbnailKey: img.thumbnailKey,
    thumbnailUrl: img.thumbnailUrl,
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

function toPublicVariantDto(v: PrismaVariant, pricing: PriceCalculation): PublicVariantDto {
  return {
    id: v.id,
    sku: v.sku,
    name: v.name,
    colorHex: v.colorHex,
    price: v.price?.toNumber() ?? null,
    maxPerOrder: v.maxPerOrder,
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

function toPublicProductDto(
  p: PrismaProduct,
  priceMap: Map<string, PriceCalculation>,
): PublicProductDto {
  const activeVariants = p.variants.filter((v) => v.isActive);
  const pricedVariants = activeVariants.map((variant) => {
    const fallbackPrice = (variant.price ?? p.basePrice).toNumber();
    return toPublicVariantDto(
      variant,
      priceMap.get(variant.id) ?? {
        regularPrice: fallbackPrice,
        discountAmount: 0,
        finalPrice: fallbackPrice,
        appliedPromotion: null,
      },
    );
  });
  // El precio "desde" y su precio regular salen de la misma variante (la de menor precio final),
  // para no mostrar tachado un precio de otra variante.
  const cheapest = pricedVariants.reduce<PublicVariantDto | null>(
    (best, variant) => (!best || variant.finalPrice < best.finalPrice ? variant : best),
    null,
  );
  const basePrice = p.basePrice.toNumber();

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
    regularPriceFrom: cheapest?.regularPrice ?? basePrice,
    finalPriceFrom: cheapest?.finalPrice ?? basePrice,
    hasDiscount: pricedVariants.some((variant) => variant.discountAmount > 0),
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
      where.name = { contains: query.q, mode: 'insensitive' };
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

    const include = {
      variants: {
        include: variantInclude,
        orderBy: { position: 'asc' as const },
      },
      images: { where: { variantId: null }, orderBy: { position: 'asc' as const } },
    };

    if (query.q) {
      const needle = normalizeSearchText(query.q);
      const candidates = await this.prisma.product.findMany({
        where,
        include,
        orderBy: { publishedAt: 'desc' },
      });
      const matches = candidates.filter((product) =>
        normalizeSearchText(product.name).includes(needle),
      );

      const page = matches.slice(skip, skip + limit);
      const priceMap = await this.priceProducts(page);
      return {
        items: page.map((p) => toPublicProductDto(p, priceMap)),
        total: matches.length,
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const priceMap = await this.priceProducts(items);
    return {
      items: items.map((p) => toPublicProductDto(p as PrismaProduct, priceMap)),
      total,
    };
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
      include: {
        variants: { include: variantInclude, orderBy: { position: 'asc' } },
        images: { where: { variantId: null }, orderBy: { position: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException(`Producto '${slug}' no encontrado.`);
    return toPublicProductDto(p, await this.priceProducts([p]));
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

    await this.prisma.product.delete({ where: { id } });
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
      throw new ConflictException('La variante tiene pedidos asociados y no puede eliminarse.');
    }

    await this.prisma.productVariant.delete({ where: { id: variantId } });
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

    const uploadsDir = resolve(this.config.get('UPLOADS_DIR', { infer: true }));
    const baseUrl = this.config.get('PUBLIC_UPLOADS_BASE_URL', { infer: true }).replace(/\/$/, '');
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

    const image = sharp(file.buffer).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new BadRequestException('El archivo no parece ser una imagen válida.');
    }

    const imageInfo = await image
      .clone()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86 })
      .toFile(absoluteImagePath);

    await image
      .clone()
      .resize({ width: 420, height: 420, fit: 'cover' })
      .webp({ quality: 78 })
      .toFile(absoluteThumbPath);

    const saved = await this.prisma.productImage.create({
      data: {
        productId,
        variantId: dto.variantId ?? null,
        storageKey,
        thumbnailKey,
        url: `${baseUrl}/${storageKey}`,
        thumbnailUrl: `${baseUrl}/${thumbnailKey}`,
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

    const uploadsDir = resolve(this.config.get('UPLOADS_DIR', { infer: true }));
    await Promise.allSettled([
      rm(join(uploadsDir, image.storageKey), { force: true }),
      rm(join(uploadsDir, image.thumbnailKey), { force: true }),
    ]);
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
