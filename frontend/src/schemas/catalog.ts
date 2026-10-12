import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la marca.').max(100, 'Máximo 100 caracteres.'),
  slug: z
    .string()
    .trim()
    .max(120, 'Máximo 120 caracteres.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo puede contener letras minúsculas, números y guiones.')
    .optional()
    .or(z.literal('')),
});

export type CreateBrandValues = z.infer<typeof createBrandSchema>;

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la categoría.').max(100, 'Máximo 100 caracteres.'),
  slug: z
    .string()
    .trim()
    .max(120, 'Máximo 120 caracteres.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo puede contener letras minúsculas, números y guiones.')
    .optional()
    .or(z.literal('')),
  parentId: z.string().uuid('Identificador inválido.').optional().or(z.literal('')),
  description: z.string().trim().max(500, 'Máximo 500 caracteres.').optional().or(z.literal('')),
  position: z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Ingresa un número entero positivo.'),
  isActive: z.boolean(),
});

export type CreateCategoryValues = z.infer<typeof createCategorySchema>;

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del producto.').max(200, 'Máximo 200 caracteres.'),
  slug: z
    .string()
    .trim()
    .max(220, 'Máximo 220 caracteres.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'El slug solo puede contener letras minúsculas, números y guiones.')
    .optional()
    .or(z.literal('')),
  shortDescription: z.string().trim().max(300, 'Máximo 300 caracteres.').optional().or(z.literal('')),
  description: z.string().trim().min(1, 'Escribe la descripción del producto.'),
  brandId: z.string().uuid('Selecciona una marca válida.'),
  categoryId: z.string().uuid('Selecciona una categoría válida.'),
  netContent: z.string().trim().max(50, 'Máximo 50 caracteres.').optional().or(z.literal('')),
  basePrice: z
    .string()
    .trim()
    .refine((v) => v !== '' && !Number.isNaN(Number(v)) && Number(v) >= 0, 'Ingresa un precio base válido.'),
  isFeatured: z.boolean(),
});

export type CreateProductValues = z.infer<typeof createProductSchema>;

export const createVariantSchema = z.object({
  sku: z.string().trim().min(1, 'Escribe el SKU.').max(50, 'Máximo 50 caracteres.'),
  name: z.string().trim().min(1, 'Escribe el nombre o tono de la variante.').max(100, 'Máximo 100 caracteres.'),
  colorHex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color en formato hexadecimal, p. ej. #F5B041.')
    .optional()
    .or(z.literal('')),
  price: z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Ingresa un precio válido.'),
  costPrice: z
    .string()
    .trim()
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Ingresa un costo válido.'),
  maxPerOrder: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 1 && Number.isInteger(Number(v))),
      'Mínimo 1 unidad entera.',
    ),
  lowStockThreshold: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number.isInteger(Number(v))),
      'Ingresa un número entero.',
    ),
});

export type CreateVariantValues = z.infer<typeof createVariantSchema>;

export const toNullableNumber = (v: string): number | null => (v.trim() === '' ? null : Number(v));
export const toRequiredNumber = (v: string): number => Number(v.trim());
