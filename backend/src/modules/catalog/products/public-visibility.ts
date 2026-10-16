import type { Prisma } from '../../../generated/prisma/client';

/**
 * Categoría visible en la tienda: activa y, si es subcategoría, con su categoría padre activa.
 * Desactivar una categoría oculta también lo que hay dentro de ella.
 */
export const visibleCategoryWhere: Prisma.CategoryWhereInput = {
  isActive: true,
  OR: [{ parentId: null }, { parent: { isActive: true } }],
};

/**
 * Producto que la tienda muestra y permite comprar (decisión del 2026-10-16, Q-09): publicado,
 * con marca activa y dentro de una categoría visible.
 */
export const publicProductWhere: Prisma.ProductWhereInput = {
  status: 'ACTIVE',
  brand: { isActive: true },
  category: visibleCategoryWhere,
};
