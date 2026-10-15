import {
  createBrandSchema,
  createCategorySchema,
  createProductSchema,
  createVariantSchema,
} from './catalog';

describe('esquemas de validación de catálogo', () => {
  describe('createBrandSchema', () => {
    it('valida el nombre obligatorio y recorta espacios', () => {
      const parsed = createBrandSchema.parse({ name: '  Maybelline  ', slug: '' });
      expect(parsed.name).toBe('Maybelline');
      expect(createBrandSchema.safeParse({ name: '' }).success).toBe(false);
    });

    it('valida formato del slug si se proporciona', () => {
      expect(createBrandSchema.safeParse({ name: 'Vogue', slug: 'vogue-cosmetics' }).success).toBe(
        true,
      );
      expect(createBrandSchema.safeParse({ name: 'Vogue', slug: 'VOGUE COSMETICS' }).success).toBe(
        false,
      );
      expect(createBrandSchema.safeParse({ name: 'Vogue', slug: 'vogue_cosmetics' }).success).toBe(
        false,
      );
    });
  });

  describe('createCategorySchema', () => {
    it('valida campos obligatorios y posición', () => {
      expect(
        createCategorySchema.safeParse({
          name: 'Labiales',
          slug: 'labiales',
          position: '0',
          isActive: true,
        }).success,
      ).toBe(true);

      expect(
        createCategorySchema.safeParse({
          name: '',
          position: '0',
          isActive: true,
        }).success,
      ).toBe(false);

      expect(
        createCategorySchema.safeParse({
          name: 'Labiales',
          position: 'no-numero',
          isActive: true,
        }).success,
      ).toBe(false);
    });
  });

  describe('createProductSchema', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('exige nombre, marca, categoría, precio y descripción', () => {
      expect(
        createProductSchema.safeParse({
          name: 'Labial Mate',
          brandId: validUuid,
          categoryId: validUuid,
          basePrice: '45000',
          description: 'Fórmula de larga duración',
          isFeatured: false,
        }).success,
      ).toBe(true);

      expect(
        createProductSchema.safeParse({
          name: 'Labial Mate',
          brandId: 'no-uuid',
          categoryId: validUuid,
          basePrice: '45000',
          description: 'Fórmula',
          isFeatured: false,
        }).success,
      ).toBe(false);

      expect(
        createProductSchema.safeParse({
          name: 'Labial Mate',
          brandId: validUuid,
          categoryId: validUuid,
          basePrice: '-100',
          description: 'Fórmula',
          isFeatured: false,
        }).success,
      ).toBe(false);
    });

    it('rechaza el precio base en 0 (sin precio final 0, decisión del 2026-10-15)', () => {
      const result = createProductSchema.safeParse({
        name: 'Labial Mate',
        brandId: validUuid,
        categoryId: validUuid,
        basePrice: '0',
        description: 'Fórmula',
        isFeatured: false,
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('Ingresa un precio base mayor que 0.');
    });
  });

  describe('createVariantSchema', () => {
    it('valida SKU y formato hex de color', () => {
      expect(
        createVariantSchema.safeParse({
          sku: 'MAYB-01',
          name: '15 Lover',
          colorHex: '#B785B8',
          price: '50000',
          costPrice: '25000',
          maxPerOrder: '3',
          lowStockThreshold: '5',
        }).success,
      ).toBe(true);

      expect(
        createVariantSchema.safeParse({
          sku: 'MAYB-01',
          name: '15 Lover',
          colorHex: 'rojo',
          price: '',
          costPrice: '',
          maxPerOrder: '',
          lowStockThreshold: '',
        }).success,
      ).toBe(false);
    });

    it('rechaza el precio propio en 0 y acepta dejarlo vacío', () => {
      const variant = {
        sku: 'MAYB-01',
        name: '15 Lover',
        colorHex: '',
        costPrice: '',
        maxPerOrder: '',
        lowStockThreshold: '',
      };
      expect(createVariantSchema.safeParse({ ...variant, price: '0' }).success).toBe(false);
      expect(createVariantSchema.safeParse({ ...variant, price: '' }).success).toBe(true);
    });
  });
});
