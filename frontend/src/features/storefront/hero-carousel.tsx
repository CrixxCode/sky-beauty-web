'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Carrusel del inicio. Cada hijo es una diapositiva a pantalla completa del bloque. Se desliza con
 * el dedo (scroll con imán) o con las flechas y los puntos; no avanza solo, para que nadie pierda
 * lo que está mirando y no se mueva para quien prefiere menos movimiento.
 */
export function HeroCarousel({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const slides = Children.toArray(children);
  const total = slides.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // La diapositiva activa sale de la posición del scroll, así coincide también al deslizar.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || total < 2) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setActive(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener('scroll', onScroll);
    };
  }, [total]);

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const next = (index + total) % total;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      track.scrollTo({ left: next * track.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    },
    [total],
  );

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label={label}
      className={cn('relative h-full w-full', className)}
    >
      <div
        ref={trackRef}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            role="group"
            aria-roledescription="diapositiva"
            aria-label={`${index + 1} de ${total}`}
            className="relative h-full w-full shrink-0 snap-start snap-always"
          >
            {slide}
          </div>
        ))}
      </div>
      {total > 1 && (
        <div className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5 max-[600px]:bottom-4 max-[600px]:right-4">
          <Button
            variant="light"
            size="icon"
            onClick={() => goTo(active - 1)}
            aria-label="Diapositiva anterior"
            className="h-10 w-10 rounded-full bg-paper/90 max-[600px]:hidden"
          >
            <ChevronLeft size={18} />
          </Button>
          <div className="flex items-center">
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`Ver diapositiva ${index + 1} de ${total}`}
                aria-current={index === active ? 'true' : undefined}
                className="grid h-10 w-7 place-items-center"
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full bg-white/70 transition-[width,background-color] duration-300',
                    index === active ? 'w-5 bg-white' : 'w-1.5',
                  )}
                />
              </button>
            ))}
          </div>
          <Button
            variant="light"
            size="icon"
            onClick={() => goTo(active + 1)}
            aria-label="Diapositiva siguiente"
            className="h-10 w-10 rounded-full bg-paper/90 max-[600px]:hidden"
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      )}
    </div>
  );
}
