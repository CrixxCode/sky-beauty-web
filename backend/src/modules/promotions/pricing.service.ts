import { Injectable, NotFoundException } from '@nestjs/common';
import { DiscountType, PromotionScope } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';

export interface AppliedPromotionPrice {
  promotionId: string;
  promotionName: string;
  scope: PromotionScope;
  discountType: DiscountType;
  discountValue: number;
}

export interface PriceCalculation {
  regularPrice: number;
  discountAmount: number;
  finalPrice: number;
  appliedPromotion: AppliedPromotionPrice | null;
}

/** Condiciones de una promoción en una fecha dada (su versión vigente en esa fecha). */
export interface PromotionSnapshot {
  promotionId: string;
  createdAt: Date;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  scope: PromotionScope;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  variantIds: string[];
  productIds: string[];
  categoryIds: string[];
}

/** Lo que se necesita saber de una variante para elegir su promoción. */
export interface VariantPricingContext {
  variantId: string;
  productId: string;
  categoryId: string;
  /** Categoría principal cuando el producto está en una subcategoría. */
  parentCategoryId: string | null;
  regularPrice: number;
}

/**
 * Descuento por unidad en COP, redondeado al peso. Nunca deja el precio final en 0
 * (decisión del 2026-10-15): si la promoción lo dejaría en 0 o menos, no aplica (devuelve 0),
 * por ejemplo un descuento fijo que supera un precio que bajó después; si es el redondeo el que
 * lo dejaría en 0, el descuento se limita para que el precio final quede en 1 COP.
 */
export function calculateDiscount(regularPrice: number, type: DiscountType, value: number): number {
  const discount = type === DiscountType.PERCENTAGE ? regularPrice * (value / 100) : value;
  if (discount <= 0 || discount >= regularPrice) return 0;
  return Math.max(0, Math.min(regularPrice - 1, Math.round(discount)));
}

function appliesTo(promotion: PromotionSnapshot, variant: VariantPricingContext): boolean {
  switch (promotion.scope) {
    case PromotionScope.VARIANT:
      return promotion.variantIds.includes(variant.variantId);
    case PromotionScope.PRODUCT:
      return promotion.productIds.includes(variant.productId);
    case PromotionScope.CATEGORY:
      // Una promoción de categoría aplica también a los productos de sus subcategorías.
      return promotion.categoryIds.some(
        (id) => id === variant.categoryId || id === variant.parentCategoryId,
      );
  }
}

/**
 * Elige la promoción de una variante en la fecha `at` (decisión del 2026-10-09):
 * no se acumulan; gana la que da mayor descuento sin importar el alcance; si hay empate,
 * gana la creada primero.
 */
export function priceWithPromotions(
  variant: VariantPricingContext,
  promotions: PromotionSnapshot[],
  at: Date,
): PriceCalculation {
  const { regularPrice } = variant;
  let winner: { promotion: PromotionSnapshot; discountAmount: number } | null = null;

  for (const promotion of promotions) {
    if (!promotion.isActive) continue;
    if (promotion.startsAt > at || promotion.endsAt < at) continue;
    if (!appliesTo(promotion, variant)) continue;

    const discountAmount = calculateDiscount(
      regularPrice,
      promotion.discountType,
      promotion.discountValue,
    );
    if (discountAmount <= 0) continue;

    const better =
      !winner ||
      discountAmount > winner.discountAmount ||
      (discountAmount === winner.discountAmount && isCreatedBefore(promotion, winner.promotion));
    if (better) winner = { promotion, discountAmount };
  }

  if (!winner) {
    return { regularPrice, discountAmount: 0, finalPrice: regularPrice, appliedPromotion: null };
  }

  return {
    regularPrice,
    discountAmount: winner.discountAmount,
    finalPrice: regularPrice - winner.discountAmount,
    appliedPromotion: {
      promotionId: winner.promotion.promotionId,
      promotionName: winner.promotion.name,
      scope: winner.promotion.scope,
      discountType: winner.promotion.discountType,
      discountValue: winner.promotion.discountValue,
    },
  };
}

/** "Creada primero"; si coinciden al milisegundo, el id decide para que el resultado sea estable. */
function isCreatedBefore(a: PromotionSnapshot, b: PromotionSnapshot): boolean {
  const diff = a.createdAt.getTime() - b.createdAt.getTime();
  return diff < 0 || (diff === 0 && a.promotionId < b.promotionId);
}

/**
 * Motor de precios: único punto donde se calcula el precio de una variante, usado por el
 * catálogo, el carrito, el checkout y la edición de pedidos. Calcula "a una fecha" con el
 * historial de precios (VariantPriceHistory) y las versiones de las promociones (PromotionRevision).
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async priceVariantAt(variantId: string, at = new Date()): Promise<PriceCalculation> {
    const price = (await this.priceVariantsAt([variantId], at)).get(variantId);
    if (!price) throw new NotFoundException(`Variante con id '${variantId}' no encontrada.`);
    return price;
  }

  /** Precios de varias variantes en la fecha `at`. Las variantes que no existen no aparecen. */
  async priceVariantsAt(
    variantIds: string[],
    at = new Date(),
  ): Promise<Map<string, PriceCalculation>> {
    const ids = [...new Set(variantIds)];
    if (ids.length === 0) return new Map();

    const [variants, history, promotions] = await Promise.all([
      this.prisma.productVariant.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          price: true,
          productId: true,
          product: {
            select: { basePrice: true, categoryId: true, category: { select: { parentId: true } } },
          },
        },
      }),
      this.prisma.variantPriceHistory.findMany({
        where: { variantId: { in: ids }, validFrom: { lte: at } },
        orderBy: [{ variantId: 'asc' }, { validFrom: 'desc' }],
        distinct: ['variantId'],
        select: { variantId: true, price: true },
      }),
      this.promotionSnapshotsAt(at),
    ]);

    const priceAt = new Map(history.map((row) => [row.variantId, row.price.toNumber()]));

    return new Map(
      variants.map((variant) => [
        variant.id,
        priceWithPromotions(
          {
            variantId: variant.id,
            productId: variant.productId,
            categoryId: variant.product.categoryId,
            parentCategoryId: variant.product.category.parentId,
            // Sin historial a esa fecha se usa el precio efectivo actual.
            regularPrice:
              priceAt.get(variant.id) ?? (variant.price ?? variant.product.basePrice).toNumber(),
          },
          promotions,
          at,
        ),
      ]),
    );
  }

  /**
   * Destinos de las promociones que pueden aplicar en `at`. Un producto que no está en ninguno no
   * tiene descuento en esa fecha; los que sí están pueden no tenerlo (p. ej. un descuento fijo que
   * supera el precio), así que el precio exacto lo sigue decidiendo `priceVariantsAt`.
   */
  async promotionTargetsAt(
    at = new Date(),
  ): Promise<{ variantIds: string[]; productIds: string[]; categoryIds: string[] }> {
    const targets = {
      variantIds: new Set<string>(),
      productIds: new Set<string>(),
      categoryIds: new Set<string>(),
    };
    for (const promotion of await this.promotionSnapshotsAt(at)) {
      if (!promotion.isActive || promotion.startsAt > at || promotion.endsAt < at) continue;
      const [set, ids] =
        promotion.scope === PromotionScope.VARIANT
          ? [targets.variantIds, promotion.variantIds]
          : promotion.scope === PromotionScope.PRODUCT
            ? [targets.productIds, promotion.productIds]
            : [targets.categoryIds, promotion.categoryIds];
      ids.forEach((id) => set.add(id));
    }
    return {
      variantIds: [...targets.variantIds],
      productIds: [...targets.productIds],
      categoryIds: [...targets.categoryIds],
    };
  }

  /**
   * Versión vigente en `at` de cada promoción creada hasta esa fecha. Solo se cargan las que
   * tienen alguna versión activa que cubra `at`: las demás no pueden aplicar en esa fecha.
   */
  private async promotionSnapshotsAt(at: Date): Promise<PromotionSnapshot[]> {
    const promotions = await this.prisma.promotion.findMany({
      where: {
        createdAt: { lte: at },
        revisions: {
          some: {
            validFrom: { lte: at },
            isActive: true,
            startsAt: { lte: at },
            endsAt: { gte: at },
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        revisions: {
          where: { validFrom: { lte: at } },
          orderBy: { validFrom: 'desc' },
          take: 1,
        },
      },
    });

    return promotions.flatMap((promotion) => {
      const revision = promotion.revisions[0];
      if (!revision) return [];
      return [
        {
          promotionId: promotion.id,
          createdAt: promotion.createdAt,
          name: revision.name,
          discountType: revision.discountType,
          discountValue: revision.discountValue.toNumber(),
          scope: revision.scope,
          startsAt: revision.startsAt,
          endsAt: revision.endsAt,
          isActive: revision.isActive,
          variantIds: revision.variantIds,
          productIds: revision.productIds,
          categoryIds: revision.categoryIds,
        },
      ];
    });
  }
}
