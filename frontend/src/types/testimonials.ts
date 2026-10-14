/** Testimonio en el panel (GET /admin/testimonials). */
export interface Testimonial {
  id: string;
  firstName: string;
  lastInitial: string;
  rating: number;
  comment: string;
  productId: string | null;
  productName: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Testimonio publicado en la tienda (GET /store/testimonials). */
export interface PublicTestimonial {
  id: string;
  /** Nombre con la inicial del apellido, p. ej. "María G.". */
  authorName: string;
  rating: number;
  comment: string;
  /** Solo si el producto sigue publicado. */
  product: { name: string; slug: string } | null;
}
