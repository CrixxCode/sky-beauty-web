import { Injectable, NotFoundException } from '@nestjs/common';
import { DiscountType, Prisma, PromotionScope } from '../../generated/prisma/client';
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

type PromotionSnapshot = {
  promotionId: string;
  createdAt: Date;
  name: string;
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  scope: PromotionScope;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  variantIds: string[];
  productIds: string[];
  categoryIds: string[];
};

function decimalToNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function calculateDiscount(
  regularPrice: number,
  type: DiscountType,
  value: Prisma.Decimal,
): number {
  const numericValue = value.toNumber();
  const discount =
    type === DiscountType.PERCENTAGE ? regularPrice * (numericValue / 100) : numericValue;
  return Math.min(regularPrice, Math.max(0, Math.round(discount)));
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async priceVariantAt(variantId: string, at = new Date()): Promise<PriceCalculation> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: { include: { category: true } },
      },
    });
    if (!variant) throw new NotFoundException(`Variante con id '${variantId}' no encontrada.`);

    const regularPrice = await this.getRegularPriceAt(
      variant.id,
      variant.price ?? variant.product.basePrice,
      at,
    );

    return this.calculateForSnapshot({
      variantId: variant.id,
      productId: variant.productId,
      categoryId: variant.product.categoryId,
      parentCategoryId: variant.product.category.parentId,
      regularPrice,
      at,
    });
  }

  async priceVariantsAt(
    variantIds: string[],
    at = new Date(),
  ): Promise<Map<string, PriceCalculation>> {
    const uniqueIds = [...new Set(variantIds)];
    const entries = await Promise.all(
      uniqueIds.map(async (id) => [id, await this.priceVariantAt(id, at)] as const),
    );
    return new Map(entries);
  }

  private async getRegularPriceAt(
    variantId: string,
    fallbackPrice: Prisma.Decimal,
    at: Date,
  ): Promise<number> {
    const historical = await this.prisma.variantPriceHistory.findFirst({
      where: { variantId, validFrom: { lte: at } },
      orderBy: { validFrom: 'desc' },
    });
    return decimalToNumber(historical?.price ?? fallbackPrice);
  }

  private async calculateForSnapshot({
    variantId,
    productId,
    categoryId,
    parentCategoryId,
    regularPrice,
    at,
  }: {
    variantId: string;
    productId: string;
    categoryId: string;
    parentCategoryId: string | null;
    regularPrice: number;
    at: Date;
  }): Promise<PriceCalculation> {
    const promotions = await this.getPromotionSnapshotsAt(at);
    const categoryIds = parentCategoryId ? [categoryId, parentCategoryId] : [categoryId];

    const candidates = promotions
      .filter((promotion) => {
        if (!promotion.isActive) return false;
        if (promotion.startsAt > at || promotion.endsAt < at) return false;
        if (promotion.scope === PromotionScope.VARIANT) {
          return promotion.variantIds.includes(variantId);
        }
        if (promotion.scope === PromotionScope.PRODUCT) {
          return promotion.productIds.includes(productId);
        }
        return promotion.categoryIds.some((id) => categoryIds.includes(id));
      })
      .map((promotion) => ({
        promotion,
        discountAmount: calculateDiscount(
          regularPrice,
          promotion.discountType,
          promotion.discountValue,
        ),
      }))
      .filter((candidate) => candidate.discountAmount > 0)
      .sort((a, b) => {
        if (b.discountAmount !== a.discountAmount) return b.discountAmount - a.discountAmount;
        return a.promotion.createdAt.getTime() - b.promotion.createdAt.getTime();
      });

    const winner = candidates[0];
    if (!winner) {
      return { regularPrice, discountAmount: 0, finalPrice: regularPrice, appliedPromotion: null };
    }

    return {
      regularPrice,
      discountAmount: winner.discountAmount,
      finalPrice: Math.max(0, regularPrice - winner.discountAmount),
      appliedPromotion: {
        promotionId: winner.promotion.promotionId,
        promotionName: winner.promotion.name,
        scope: winner.promotion.scope,
        discountType: winner.promotion.discountType,
        discountValue: winner.promotion.discountValue.toNumber(),
      },
    };
  }

  private async getPromotionSnapshotsAt(at: Date): Promise<PromotionSnapshot[]> {
    const promotions = await this.prisma.promotion.findMany({
      where: { createdAt: { lte: at } },
      include: {
        revisions: {
          where: { validFrom: { lte: at } },
          orderBy: { validFrom: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return promotions
      .map((promotion) => {
        const revision = promotion.revisions[0];
        if (!revision) return null;
        return {
          promotionId: promotion.id,
          createdAt: promotion.createdAt,
          name: revision.name,
          discountType: revision.discountType,
          discountValue: revision.discountValue,
          scope: revision.scope,
          startsAt: revision.startsAt,
          endsAt: revision.endsAt,
          isActive: revision.isActive,
          variantIds: revision.variantIds,
          productIds: revision.productIds,
          categoryIds: revision.categoryIds,
        };
      })
      .filter((promotion): promotion is PromotionSnapshot => promotion !== null);
  }
}
