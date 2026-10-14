import { z } from 'zod';
import { normalizeWhatsappNumber } from '@/lib/format';

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);
const urlOrEmpty = z
  .string()
  .trim()
  .max(300, 'Máximo 300 caracteres.')
  .refine(
    (v) => v === '' || /^https?:\/\/\S+\.\S+/.test(v),
    'Ingresa una dirección completa (https://…).',
  );

/** Los campos vacíos se envían como cadena vacía; el backend los guarda como "sin valor". */
export const contactSettingsSchema = z.object({
  whatsappNumber: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || /^\d{11,15}$/.test(normalizeWhatsappNumber(v)),
      'Ingresa un número de WhatsApp válido, por ejemplo 300 123 4567.',
    ),
  contactEmail: z
    .string()
    .trim()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Ingresa un correo válido.'),
  contactPhone: text(30),
  addressText: text(200),
  businessHours: text(200),
  instagramUrl: urlOrEmpty,
  facebookUrl: urlOrEmpty,
  tiktokUrl: urlOrEmpty,
});
export type ContactSettingsValues = z.infer<typeof contactSettingsSchema>;

/** Número escrito como texto: vacío = sin configurar (null). */
const optionalNumber = (check: (n: number) => boolean, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && check(Number(v))), message);

export const commercialSettingsSchema = z.object({
  nationalFreeShipping: z.boolean(),
  freeShippingThreshold: optionalNumber(
    (n) => n >= 0 && Number.isInteger(n),
    'Ingresa un valor en pesos, sin decimales.',
  ),
  defaultLowStockThreshold: optionalNumber(
    (n) => n >= 0 && Number.isInteger(n) && n <= 100_000,
    'Ingresa un número entero de unidades.',
  ),
  maxPercentageDiscount: optionalNumber(
    (n) => n > 0 && n <= 100,
    'Ingresa un porcentaje mayor que 0 y hasta 100.',
  ),
  maxUnitsPerProduct: optionalNumber(
    (n) => Number.isInteger(n) && n >= 1 && n <= 999,
    'Ingresa un número entero de unidades, de 1 a 999.',
  ),
});
export type CommercialSettingsValues = z.infer<typeof commercialSettingsSchema>;

/** Convierte el texto de un campo numérico al valor que espera la API. */
export const toNullableNumber = (v: string): number | null => (v.trim() === '' ? null : Number(v));
