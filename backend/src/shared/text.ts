const spanishCollator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

/**
 * Compara textos en orden alfabético español ("Córdoba" antes de "Cundinamarca"). La base de datos
 * ordena por bytes y deja las letras con tilde después de las demás.
 */
export function compareSpanish(a: string, b: string): number {
  return spanishCollator.compare(a, b);
}

/** Ordena por nombre en orden alfabético español. */
export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareSpanish(a.name, b.name));
}

/**
 * Escapa los comodines de LIKE (`%`, `_` y `\`) para que una búsqueda los trate como texto literal.
 * Prisma los pasa sin escapar en `contains`, así que "%" coincidía con todo.
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
