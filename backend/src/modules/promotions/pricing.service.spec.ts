import { DiscountType, Prisma, PromotionScope } from '../../generated/prisma/client';
import { PricingService } from './pricing.service';

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function promotion({
  id,
  createdAt,
  revision,
  discountType,
  discountValue,
  scope,
  variantIds = [],
  productIds = [],
  categoryIds = [],
}: {
  id: string;
  createdAt: Date;
  revision: Date;
  discountType: DiscountType;
  discountValue: number;
  scope: PromotionScope;
  variantIds?: string[];
  productIds?: string[];
  categoryIds?: string[];
}) {
  return {
    id,
    createdAt,
    revisions: [
      {
        name: id,
        discountType,
        discountValue: decimal(discountValue),
        scope,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        endsAt: new Date('2026-12-31T23:59:59.000Z'),
        isActive: true,
        validFrom: revision,
        variantIds,
        productIds,
        categoryIds,
      },
    ],
  };
}

describe('PricingService', () => {
  const at = new Date('2026-06-15T12:00:00.000Z');

  function createService(promotions: unknown[], priceHistory?: { price: Prisma.Decimal }) {
    const prisma = {
      productVariant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'variant-1',
          productId: 'product-1',
          price: null,
          product: {
            id: 'product-1',
            basePrice: decimal(10000),
            categoryId: 'category-child',
            category: { parentId: 'category-parent' },
          },
        }),
      },
      variantPriceHistory: {
        findFirst: jest.fn().mockResolvedValue(priceHistory ?? null),
      },
      promotion: {
        findMany: jest.fn().mockResolvedValue(promotions),
      },
    };
    return new PricingService(prisma as never);
  }

  it('aplica la promocion que da mayor descuento sin importar el alcance', async () => {
    const service = createService([
      promotion({
        id: 'variante-10',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        revision: new Date('2026-01-01T00:00:00.000Z'),
        discountType: DiscountType.PERCENTAGE,
        discountValue: 10,
        scope: PromotionScope.VARIANT,
        variantIds: ['variant-1'],
      }),
      promotion({
        id: 'categoria-2000',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        revision: new Date('2026-02-01T00:00:00.000Z'),
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 2000,
        scope: PromotionScope.CATEGORY,
        categoryIds: ['category-parent'],
      }),
    ]);

    await expect(service.priceVariantAt('variant-1', at)).resolves.toMatchObject({
      regularPrice: 10000,
      discountAmount: 2000,
      finalPrice: 8000,
      appliedPromotion: { promotionId: 'categoria-2000', scope: PromotionScope.CATEGORY },
    });
  });

  it('desempata por la promocion creada primero cuando el descuento es igual', async () => {
    const service = createService([
      promotion({
        id: 'producto-antigua',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        revision: new Date('2026-01-01T00:00:00.000Z'),
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 2000,
        scope: PromotionScope.PRODUCT,
        productIds: ['product-1'],
      }),
      promotion({
        id: 'variante-nueva',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        revision: new Date('2026-03-01T00:00:00.000Z'),
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 2000,
        scope: PromotionScope.VARIANT,
        variantIds: ['variant-1'],
      }),
    ]);

    await expect(service.priceVariantAt('variant-1', at)).resolves.toMatchObject({
      discountAmount: 2000,
      appliedPromotion: { promotionId: 'producto-antigua', scope: PromotionScope.PRODUCT },
    });
  });

  it('calcula con precio historico y revision vigente a la fecha consultada', async () => {
    const service = createService(
      [
        promotion({
          id: 'historial',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          revision: new Date('2026-05-01T00:00:00.000Z'),
          discountType: DiscountType.PERCENTAGE,
          discountValue: 25,
          scope: PromotionScope.PRODUCT,
          productIds: ['product-1'],
        }),
      ],
      { price: decimal(8000) },
    );

    await expect(service.priceVariantAt('variant-1', at)).resolves.toMatchObject({
      regularPrice: 8000,
      discountAmount: 2000,
      finalPrice: 6000,
      appliedPromotion: { promotionId: 'historial' },
    });
  });
});
