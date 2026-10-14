import { z } from 'zod';

/** Formulario de testimonio (mismas reglas que el backend). */
export const testimonialSchema = z.object({
  firstName: z.string().trim().min(1, 'Escribe el nombre.').max(60, 'Máximo 60 caracteres.'),
  // Se acepta con o sin punto ("G" o "G."); se envía en mayúscula y sin punto.
  lastInitial: z
    .string()
    .trim()
    .regex(/^\p{L}\.?$/u, 'Escribe solo la primera letra del apellido.'),
  rating: z.string().regex(/^[1-5]$/, 'Elige la valoración.'),
  comment: z.string().trim().min(1, 'Escribe el comentario.').max(600, 'Máximo 600 caracteres.'),
  /** Vacío: sin producto. */
  productId: z.string(),
  isPublished: z.boolean(),
});

export type TestimonialFormValues = z.infer<typeof testimonialSchema>;

/** Cuerpo de la API a partir del formulario. */
export function testimonialPayload(values: TestimonialFormValues) {
  return {
    firstName: values.firstName.trim(),
    lastInitial: values.lastInitial.trim().replace(/\.$/, '').toLocaleUpperCase('es-CO'),
    rating: Number(values.rating),
    comment: values.comment.trim(),
    productId: values.productId || null,
    isPublished: values.isPublished,
  };
}
