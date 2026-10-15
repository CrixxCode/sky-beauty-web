/** Filas por página en los listados del panel. */
export const ADMIN_PAGE_SIZE = 20;

/** Máximo de elementos por página que acepta la API. */
const API_MAX_PAGE_SIZE = 100;

/** Número de páginas para `total` elementos; al menos 1 aunque no haya resultados. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * Páginas que se muestran en la paginación: la primera, la última, la actual y sus vecinas.
 * 'gap' marca dónde se saltan páginas (elipsis).
 */
export function pageList(current: number, total: number): Array<number | 'gap'> {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  return sorted.flatMap((page, index) =>
    index > 0 && page - sorted[index - 1] > 1 ? (['gap', page] as const) : [page],
  );
}

/**
 * Reúne todas las páginas de un listado de la API (que entrega hasta 100 por página), para los
 * selectores que necesitan el catálogo completo.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchPage(page, API_MAX_PAGE_SIZE);
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) return items;
  }
}
