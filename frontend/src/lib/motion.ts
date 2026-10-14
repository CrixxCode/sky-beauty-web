/** Misma curva que `--ease-out-strong` de globals.css, para animaciones con la Web Animations API. */
export const EASE_OUT_STRONG = 'cubic-bezier(0.23, 1, 0.32, 1)';

/**
 * Preferencia del sistema de reducir movimiento. Las animaciones con `element.animate()` no las
 * apaga la regla de globals.css, así que cada una la consulta antes de moverse.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
