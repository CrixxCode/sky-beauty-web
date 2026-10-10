import { formatCOP, normalizeWhatsappNumber, whatsappUrl } from '@/lib/format';
import {
  commercialSettingsSchema,
  contactSettingsSchema,
  toNullableNumber,
} from './store-settings';

const emptyContact = {
  whatsappNumber: '',
  contactEmail: '',
  contactPhone: '',
  addressText: '',
  businessHours: '',
  instagramUrl: '',
  facebookUrl: '',
  tiktokUrl: '',
};

describe('configuración de la tienda', () => {
  it('acepta campos vacíos (sin configurar)', () => {
    expect(contactSettingsSchema.safeParse(emptyContact).success).toBe(true);
    expect(
      commercialSettingsSchema.safeParse({
        freeShippingThreshold: '',
        defaultLowStockThreshold: '',
        maxPercentageDiscount: '',
      }).success,
    ).toBe(true);
  });

  it('valida WhatsApp con o sin 57 y rechaza fijos sin código de país', () => {
    const parse = (whatsappNumber: string) =>
      contactSettingsSchema.safeParse({ ...emptyContact, whatsappNumber }).success;
    expect(parse('300 123 4567')).toBe(true);
    expect(parse('+57 300 123 4567')).toBe(true);
    expect(parse('601 555 1234')).toBe(false);
  });

  it('exige direcciones web completas', () => {
    const parse = (instagramUrl: string) =>
      contactSettingsSchema.safeParse({ ...emptyContact, instagramUrl }).success;
    expect(parse('https://instagram.com/tienda')).toBe(true);
    expect(parse('instagram.com/tienda')).toBe(false);
  });

  it('valida las cifras comerciales', () => {
    const parse = (values: Record<string, string>) =>
      commercialSettingsSchema.safeParse({
        freeShippingThreshold: '',
        defaultLowStockThreshold: '',
        maxPercentageDiscount: '',
        ...values,
      }).success;
    expect(parse({ freeShippingThreshold: '150000' })).toBe(true);
    expect(parse({ freeShippingThreshold: '150000.5' })).toBe(false);
    expect(parse({ defaultLowStockThreshold: '2.5' })).toBe(false);
    expect(parse({ maxPercentageDiscount: '0' })).toBe(false);
    expect(parse({ maxPercentageDiscount: '101' })).toBe(false);
    expect(parse({ maxPercentageDiscount: '50' })).toBe(true);
  });

  it('convierte los campos numéricos para la API', () => {
    expect(toNullableNumber('')).toBeNull();
    expect(toNullableNumber(' 150000 ')).toBe(150000);
  });
});

describe('formato', () => {
  it('normaliza WhatsApp igual que el backend y arma el enlace', () => {
    expect(normalizeWhatsappNumber('300 123 4567')).toBe('573001234567');
    expect(whatsappUrl('573001234567')).toBe('https://wa.me/573001234567');
  });

  it('formatea pesos colombianos sin decimales', () => {
    expect(formatCOP(150000).replace(/\s/g, ' ')).toBe('$ 150.000');
  });
});
