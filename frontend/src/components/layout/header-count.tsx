'use client';

import { useEffect, useRef } from 'react';
import { EASE_OUT_STRONG, prefersReducedMotion } from '@/lib/motion';

/**
 * Contador de los íconos del encabezado (bolsa y favoritos). Cuando el número sube, aparece o da
 * un pequeño salto para confirmar que la acción llegó. Lo que ya estaba guardado en el navegador
 * no se anima al cargar la página. Bajar el número (quitar) no se anima.
 */
export function HeaderCount({ count, ready }: { count: number; ready: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  // null hasta que se lee lo guardado en el navegador.
  const previous = useRef<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    const before = previous.current;
    previous.current = count;
    const element = ref.current;
    if (before === null || count <= before || !element) return;

    const reduce = prefersReducedMotion();
    let keyframes: Keyframe[];
    let duration: number;
    if (before === 0) {
      // Nunca desde la nada: entra desde una escala visible, con un fundido.
      keyframes = reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: 'scale(0.6)' },
            { opacity: 1, transform: 'scale(1)' },
          ];
      duration = 220;
    } else {
      if (reduce) return;
      keyframes = [
        { transform: 'scale(1)', easing: 'ease-out' },
        { transform: 'scale(1.2)', offset: 0.35, easing: EASE_OUT_STRONG },
        { transform: 'scale(1)' },
      ];
      duration = 320;
    }
    element.getAnimations().forEach((animation) => animation.cancel());
    element.animate(keyframes, { duration, easing: before === 0 ? EASE_OUT_STRONG : 'linear' });
  }, [count, ready]);

  if (count <= 0) return null;
  return (
    <span
      ref={ref}
      className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-mauve-dark px-1 text-xs leading-none tabular-nums text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
