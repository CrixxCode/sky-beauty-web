import { DiscountType, PromotionScope } from '../../generated/prisma/client';
import {
  calculateDiscount,
  priceWithPromotions,
  type PromotionSnapshot,
  type VariantPricingContext,
} from './pricing.service';

const AT = new Date('2026-06-15T12:00:00.000Z');

const variant = (overrides: Partial<VariantPricingContext> = {}): VariantPricingContext => ({
  variantId: 'variante-1',
  productId: 'producto-1',
  categoryId: 'subcategoria',
  parentCategoryId: 'categoria',
  regularPrice: 10000,
  ...overrides,
});

let sequence = 0;
/** Promoción vigente todo 2026; cada una se crea un día después de la anterior salvo que se indique. */
function promo(overrides: Partial<PromotionSnapshot> = {}): PromotionSnapshot {
  sequence += 1;
  return {
    promotionId: `promo-${sequence}`,
    createdAt: new Date(Date.UTC(2026, 0, sequence)),
    name: `Promoción ${sequence}`,
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    scope: PromotionScope.PRODUCT,
    startsAt: new Date('2026-01-01T00:00:00.000Z'),
    endsAt: new Date('2026-12-31T23:59:59.999Z'),
    isActive: true,
    variantIds: [],
    productIds: ['producto-1'],
    categoryIds: [],
    ...overrides,
  };
}

const pct = (value: number, o: Partial<PromotionSnapshot> = {}) =>
  promo({ discountType: DiscountType.PERCENTAGE, discountValue: value, ...o });
const fixed = (value: number, o: Partial<PromotionSnapshot> = {}) =>
  promo({ discountType: DiscountType.FIXED_AMOUNT, discountValue: value, ...o });
const onVariant = (id = 'variante-1') => ({
  scope: PromotionScope.VARIANT,
  variantIds: [id],
  productIds: [],
});
const onCategory = (...ids: string[]) => ({
  scope: PromotionScope.CATEGORY,
  categoryIds: ids,
  productIds: [],
});

const winnerOf = (v: VariantPricingContext, promotions: PromotionSnapshot[], at = AT) =>
  priceWithPromotions(v, promotions, at).appliedPromotion?.promotionId ?? null;

describe('calculateDiscount', () => {
  it('calcula porcentajes redondeando al peso', () => {
    expect(calculateDiscount(10000, DiscountType.PERCENTAGE, 15)).toBe(1500);
    expect(calculateDiscount(9990, DiscountType.PERCENTAGE, 15)).toBe(1499); // 1498,5
    expect(calculateDiscount(9999, DiscountType.PERCENTAGE, 33.33)).toBe(3333);
  });

  it('aplica importes fijos por unidad', () => {
    expect(calculateDiscount(10000, DiscountType.FIXED_AMOUNT, 2500)).toBe(2500);
  });

  it('nunca descuenta más que el precio ni un valor negativo', () => {
    expect(calculateDiscount(10000, DiscountType.FIXED_AMOUNT, 15000)).toBe(10000);
    expect(calculateDiscount(10000, DiscountType.PERCENTAGE, 100)).toBe(10000);
    expect(calculateDiscount(10000, DiscountType.FIXED_AMOUNT, -5)).toBe(0);
  });
});

describe('priceWithPromotions', () => {
  beforeEach(() => {
    sequence = 0;
  });

  it('sin promociones deja el precio regular', () => {
    expect(priceWithPromotions(variant(), [], AT)).toEqual({
      regularPrice: 10000,
      discountAmount: 0,
      finalPrice: 10000,
      appliedPromotion: null,
    });
  });

  it('devuelve precio regular, descuento, precio final y la promoción aplicada', () => {
    const p = pct(25, onVariant());
    expect(priceWithPromotions(variant(), [p], AT)).toEqual({
      regularPrice: 10000,
      discountAmount: 2500,
      finalPrice: 7500,
      appliedPromotion: {
        promotionId: p.promotionId,
        promotionName: p.name,
        scope: PromotionScope.VARIANT,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 25,
      },
    });
  });

  describe('no se acumulan: gana el mayor descuento sin importar el alcance', () => {
    it('aplica una sola promoción aunque coincidan varias', () => {
      const result = priceWithPromotions(variant(), [pct(10), pct(20, onVariant())], AT);
      expect(result.discountAmount).toBe(2000);
      expect(result.finalPrice).toBe(8000);
    });

    it('una de categoría gana a una de variante si descuenta más', () => {
      const v = pct(10, onVariant());
      const c = fixed(2000, onCategory('categoria'));
      expect(winnerOf(variant(), [v, c])).toBe(c.promotionId);
    });

    it('una de variante gana a una de categoría si descuenta más', () => {
      const c = pct(10, onCategory('categoria'));
      const v = fixed(1500, onVariant());
      expect(winnerOf(variant(), [c, v])).toBe(v.promotionId);
    });

    it('la comparación es en pesos: el ganador entre % y fijo depende del precio', () => {
      const p10 = pct(10, onVariant());
      const f2000 = fixed(2000);
      expect(winnerOf(variant({ regularPrice: 10000 }), [p10, f2000])).toBe(f2000.promotionId);
      expect(winnerOf(variant({ regularPrice: 30000 }), [p10, f2000])).toBe(p10.promotionId);
    });

    it('el orden en que llegan las promociones no cambia el resultado', () => {
      const list = [pct(10), fixed(2500, onVariant()), pct(15, onCategory('categoria'))];
      const expected = list[1].promotionId;
      expect(winnerOf(variant(), list)).toBe(expected);
      expect(winnerOf(variant(), [...list].reverse())).toBe(expected);
    });
  });

  describe('empates: gana la creada primero', () => {
    it('sin importar el alcance', () => {
      const older = fixed(2000); // producto, creada antes
      const newer = fixed(2000, onVariant());
      expect(winnerOf(variant(), [newer, older])).toBe(older.promotionId);
    });

    it('un porcentaje y un fijo que dan el mismo importe empatan', () => {
      const older = pct(20, onCategory('categoria'));
      const newer = fixed(2000, onVariant());
      expect(winnerOf(variant(), [newer, older])).toBe(older.promotionId);
    });

    it('si se crearon en el mismo instante el resultado es estable', () => {
      const createdAt = new Date('2026-02-01T00:00:00.000Z');
      const a = fixed(1000, { promotionId: 'a', createdAt });
      const b = fixed(1000, { promotionId: 'b', createdAt });
      expect(winnerOf(variant(), [b, a])).toBe('a');
      expect(winnerOf(variant(), [a, b])).toBe('a');
    });
  });

  describe('alcance', () => {
    it('una de variante solo aplica a esa variante', () => {
      const p = pct(30, onVariant('variante-1'));
      expect(winnerOf(variant(), [p])).toBe(p.promotionId);
      expect(winnerOf(variant({ variantId: 'variante-2' }), [p])).toBeNull();
    });

    it('una de producto aplica a todas sus variantes y a ningún otro producto', () => {
      const p = pct(30);
      expect(winnerOf(variant({ variantId: 'variante-2' }), [p])).toBe(p.promotionId);
      expect(winnerOf(variant({ productId: 'producto-2' }), [p])).toBeNull();
    });

    it('una de categoría aplica también a los productos de sus subcategorías', () => {
      const p = pct(30, onCategory('categoria'));
      expect(winnerOf(variant(), [p])).toBe(p.promotionId);
    });

    it('una de subcategoría no aplica a otras subcategorías de la misma categoría', () => {
      const p = pct(30, onCategory('subcategoria'));
      expect(winnerOf(variant(), [p])).toBe(p.promotionId);
      expect(winnerOf(variant({ categoryId: 'otra-subcategoria' }), [p])).toBeNull();
    });

    it('aplica a productos que están directamente en una categoría sin subcategorías', () => {
      const p = pct(30, onCategory('categoria-sola'));
      const v = variant({ categoryId: 'categoria-sola', parentCategoryId: null });
      expect(winnerOf(v, [p])).toBe(p.promotionId);
    });

    it('no aplica a categorías ajenas', () => {
      expect(winnerOf(variant(), [pct(30, onCategory('otra'))])).toBeNull();
    });
  });

  describe('vigencia y activación', () => {
    it('ignora promociones desactivadas', () => {
      expect(winnerOf(variant(), [pct(50, { isActive: false })])).toBeNull();
    });

    it('una desactivada no le gana a una activa con menor descuento', () => {
      const active = pct(10);
      expect(winnerOf(variant(), [pct(50, { isActive: false }), active])).toBe(active.promotionId);
    });

    it('aplica desde el instante de inicio hasta el instante de fin, incluidos', () => {
      const startsAt = new Date('2026-06-01T00:00:00.000Z');
      const endsAt = new Date('2026-06-30T23:59:59.000Z');
      const p = pct(10, { startsAt, endsAt });
      expect(winnerOf(variant(), [p], startsAt)).toBe(p.promotionId);
      expect(winnerOf(variant(), [p], endsAt)).toBe(p.promotionId);
      expect(winnerOf(variant(), [p], new Date(startsAt.getTime() - 1))).toBeNull();
      expect(winnerOf(variant(), [p], new Date(endsAt.getTime() + 1))).toBeNull();
    });

    it('una vencida no le gana a una vigente con menor descuento', () => {
      const expired = pct(50, { endsAt: new Date('2026-05-01T00:00:00.000Z') });
      const current = pct(5);
      expect(winnerOf(variant(), [expired, current])).toBe(current.promotionId);
    });
  });

  describe('límites del precio', () => {
    it('un descuento fijo mayor que el precio deja el precio final en 0, nunca negativo', () => {
      const result = priceWithPromotions(variant({ regularPrice: 3000 }), [fixed(5000)], AT);
      expect(result.discountAmount).toBe(3000);
      expect(result.finalPrice).toBe(0);
    });

    it('una promoción que no alcanza a descontar un peso no se muestra como aplicada', () => {
      const result = priceWithPromotions(variant({ regularPrice: 40 }), [pct(1)], AT);
      expect(result).toMatchObject({ discountAmount: 0, finalPrice: 40, appliedPromotion: null });
    });
  });
});
