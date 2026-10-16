import { DiscountType, PromotionScope } from '../../generated/prisma/client';
import {
  calculateDiscount,
  priceWithPromotions,
  promotionIndex,
  pricesWithPromotions,
  type PromotionSnapshot,
  type VariantPricingContext,
} from './pricing.service';

const AT = new Date('2026-06-15T12:00:00.000Z');

describe('precios agrupados sin caché entre peticiones', () => {
  it('equivale al motor individual con distintos precios, destinos y vigencias', () => {
    const variants = Array.from({ length: 120 }, (_, i) =>
      variant({
        variantId: `v-${i}`,
        productId: `p-${Math.floor(i / 3)}`,
        categoryId: `c-${i % 4}`,
        parentCategoryId: i % 2 ? 'principal' : null,
        regularPrice: [1, 10000, 20000][i % 3],
      }),
    );
    const promotions = Array.from({ length: 45 }, (_, i) =>
      promo({
        scope: [PromotionScope.CATEGORY, PromotionScope.PRODUCT, PromotionScope.VARIANT][i % 3],
        categoryIds: [`c-${i % 4}`, 'principal'],
        productIds: [`p-${i % 40}`],
        variantIds: [`v-${i % 120}`],
        discountType: i % 2 ? DiscountType.FIXED_AMOUNT : DiscountType.PERCENTAGE,
        discountValue: i % 2 ? 5000 : 20,
        isActive: i % 5 !== 0,
        startsAt: i % 7 ? new Date('2026-01-01') : new Date('2027-01-01'),
      }),
    );
    const grouped = pricesWithPromotions(variants, promotions, AT);
    for (const item of variants)
      expect(grouped.get(item.variantId)).toEqual(priceWithPromotions(item, promotions, AT));
    // Una petición nueva recibe los cambios; nunca conserva un precio anterior.
    expect(pricesWithPromotions(variants, [], AT).get('v-1')?.discountAmount).toBe(0);
  });
});

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

  it('no aplica si el descuento dejaría el precio en 0 o menos, ni con valores negativos', () => {
    expect(calculateDiscount(10000, DiscountType.FIXED_AMOUNT, 15000)).toBe(0);
    expect(calculateDiscount(10000, DiscountType.FIXED_AMOUNT, 10000)).toBe(0);
    expect(calculateDiscount(10000, DiscountType.PERCENTAGE, 100)).toBe(0);
    expect(calculateDiscount(10000, DiscountType.FIXED_AMOUNT, -5)).toBe(0);
  });

  it('el redondeo nunca deja el precio final por debajo de 1 COP', () => {
    expect(calculateDiscount(1, DiscountType.PERCENTAGE, 50)).toBe(0); // 0,5 → no alcanza
    expect(calculateDiscount(3, DiscountType.PERCENTAGE, 90)).toBe(2); // 2,7 → 3 dejaría 0
    expect(calculateDiscount(10000, DiscountType.FIXED_AMOUNT, 9999)).toBe(9999);
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
    it('un descuento fijo igual o mayor que el precio no se aplica (sin precio final 0)', () => {
      for (const amount of [3000, 5000]) {
        const result = priceWithPromotions(variant({ regularPrice: 3000 }), [fixed(amount)], AT);
        expect(result).toMatchObject({
          discountAmount: 0,
          finalPrice: 3000,
          appliedPromotion: null,
        });
      }
    });

    it('si una promoción no aplica por dejar el precio en 0, puede ganar otra menor', () => {
      const big = fixed(5000);
      const small = pct(10);
      const result = priceWithPromotions(variant({ regularPrice: 3000 }), [big, small], AT);
      expect(result.appliedPromotion?.promotionId).toBe(small.promotionId);
      expect(result.finalPrice).toBe(2700);
    });

    it('una promoción que no alcanza a descontar un peso no se muestra como aplicada', () => {
      const result = priceWithPromotions(variant({ regularPrice: 40 }), [pct(1)], AT);
      expect(result).toMatchObject({ discountAmount: 0, finalPrice: 40, appliedPromotion: null });
    });
  });
});

describe('promotionIndex', () => {
  it('da el mismo precio que comparar cada variante con todas las promociones', () => {
    // Generador determinista: alcances, destinos, fechas, estados y montos variados.
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    const ids = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => `${prefix}-${i}`);
    const [variants, products, categories] = [ids('v', 30), ids('p', 12), ids('c', 6)];
    const pick = (list: string[]) => list.filter(() => rand(4) === 0);
    const scopes = [PromotionScope.VARIANT, PromotionScope.PRODUCT, PromotionScope.CATEGORY];
    const promotions = Array.from({ length: 40 }, (_, i) =>
      promo({
        scope: scopes[rand(3)],
        variantIds: pick(variants),
        productIds: pick(products),
        categoryIds: pick(categories),
        isActive: rand(5) > 0,
        startsAt: new Date(Date.UTC(2026, rand(12), 1)),
        endsAt: new Date(Date.UTC(2026, 6 + rand(6), 28)),
        discountType: rand(2) ? DiscountType.PERCENTAGE : DiscountType.FIXED_AMOUNT,
        discountValue: rand(2) ? 5 + rand(60) : 1000 * (1 + rand(15)),
        createdAt: new Date(Date.UTC(2025, 11, 1 + (i % 3))),
      }),
    );
    const candidatesFor = promotionIndex(promotions, AT);

    for (const [i, variantId] of variants.entries()) {
      const context = variant({
        variantId,
        productId: products[i % products.length],
        categoryId: categories[i % categories.length],
        parentCategoryId: i % 2 ? categories[(i + 1) % categories.length] : null,
        regularPrice: 2000 + rand(30) * 1000,
      });
      expect(priceWithPromotions(context, candidatesFor(context), AT)).toEqual(
        priceWithPromotions(context, promotions, AT),
      );
    }
  });
});
