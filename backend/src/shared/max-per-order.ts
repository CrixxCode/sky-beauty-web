/**
 * Máximo de unidades de una variante en un pedido: el menor entre el de la variante y el tope
 * general de la tienda (StoreSettings.maxUnitsPerProduct). null = sin límite.
 */
export function effectiveMaxPerOrder(
  variantMax: number | null,
  generalMax: number | null,
): number | null {
  if (variantMax === null) return generalMax;
  if (generalMax === null) return variantMax;
  return Math.min(variantMax, generalMax);
}
