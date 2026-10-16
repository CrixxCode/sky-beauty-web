'use client';

import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { toast } from 'sonner';
import { HeaderCount } from '@/components/layout/header-count';
import { Button } from '@/components/ui/button';
import { EASE_OUT_STRONG, prefersReducedMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { MAX_FAVORITES, useFavorites } from './favorites-context';

/**
 * Guardar o quitar un producto de favoritos (replica .heart-btn del prototipo). `variant`:
 * `overlay` va sobre la foto de la tarjeta; `outline` es el botón del detalle del producto.
 */
export function FavoriteButton({
  productId,
  productName,
  variant = 'overlay',
  className,
}: {
  productId: string;
  productName: string;
  variant?: 'overlay' | 'outline';
  className?: string;
}) {
  const { isFavorite, toggle, ids } = useFavorites();
  const saved = isFavorite(productId);
  const heart = useRef<SVGSVGElement>(null);

  function onClick() {
    if (!saved && ids.length >= MAX_FAVORITES) {
      toast.error(
        `Puedes guardar hasta ${MAX_FAVORITES} favoritos. Quita alguno para agregar más.`,
      );
      return;
    }
    const nowSaved = toggle(productId);
    // Guardar es un momento de gusto: el corazón late una vez. Quitar solo cambia el relleno.
    if (nowSaved && heart.current && !prefersReducedMotion()) {
      heart.current.animate(
        [
          { transform: 'scale(0.85)' },
          { transform: 'scale(1.18)', offset: 0.4 },
          { transform: 'scale(1)' },
        ],
        { duration: 380, easing: EASE_OUT_STRONG },
      );
    }
    toast.success(nowSaved ? 'Guardado en tus favoritos.' : 'Quitado de tus favoritos.', {
      id: `favorito-${productId}`,
    });
  }

  // El relleno se funde con fill-opacity: de `none` a un color no hay transición posible.
  const icon = (
    <Heart
      ref={heart}
      size={19}
      fill="currentColor"
      style={{ fillOpacity: saved ? 1 : 0 }}
      className="origin-center transition-[fill-opacity] duration-200 ease-out-strong"
      aria-hidden="true"
    />
  );

  if (variant === 'outline') {
    return (
      <Button
        variant="outline"
        onClick={onClick}
        aria-pressed={saved}
        className={cn(saved && 'text-[#a15f85]', className)}
      >
        {icon}
        {saved ? 'Guardado en favoritos' : 'Guardar en favoritos'}
      </Button>
    );
  }

  return (
    <Button
      variant="light"
      size="icon"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={`Guardar ${productName} en favoritos`}
      className={cn(
        'h-11 w-11 rounded-full bg-paper/93 text-[#6d5369] shadow-[0_2px_10px_rgb(59_36_46/0.08)] not-disabled:hover:bg-white',
        saved && 'text-[#a15f85]',
        className,
      )}
    >
      {icon}
    </Button>
  );
}

/** Corazón del encabezado con la cantidad de favoritos guardados. */
export function FavoritesHeaderLink() {
  const { ids, ready } = useFavorites();
  const count = ready ? ids.length : 0;
  return (
    <Link
      href="/favoritos"
      className="relative grid h-11 w-11 place-items-center text-[#3a2c36] hover:text-[#70436f]"
      aria-label={`Favoritos, ${count} ${count === 1 ? 'producto' : 'productos'}`}
    >
      <Heart size={20} strokeWidth={1.7} />
      <HeaderCount count={count} ready={ready} />
    </Link>
  );
}
