'use client';

import Autoplay from 'embla-carousel-autoplay';
import { Pause, Play } from 'lucide-react';
import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from '@/components/ui/carousel';
import { cn } from '@/lib/utils';

const controlClass = 'static size-10 translate-y-0 rounded-full bg-paper/90';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * Carrusel del inicio. Cada hijo es una diapositiva a pantalla completa del bloque. Avanza solo y
 * en bucle; además se desliza con el dedo, arrastrando con el mouse, con las flechas, con los
 * puntos o con el teclado.
 *
 * El avance automático se detiene mientras el mouse está encima o el foco está dentro (para que
 * nadie pierda lo que está mirando) y se reanuda al salir. El botón de pausa lo detiene hasta que
 * se vuelva a activar. Con "reducir movimiento" en el sistema arranca en pausa.
 */
export function HeroCarousel({
  label,
  className,
  autoplayDelay = 6000,
  children,
}: {
  label: string;
  className?: string;
  /** Milisegundos que se muestra cada diapositiva antes de pasar a la siguiente. */
  autoplayDelay?: number;
  children: ReactNode;
}) {
  const slides = Children.toArray(children);
  const total = slides.length;
  const [api, setApi] = useState<CarouselApi>();
  const [active, setActive] = useState(0);
  // Sin elección de la persona, la pausa sigue la preferencia de "reducir movimiento" del sistema.
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
  const [userPaused, setUserPaused] = useState<boolean | null>(null);
  const paused = userPaused ?? reduceMotion;
  // Pausas pasajeras (mouse encima o foco dentro); no cambian el botón de pausa.
  const hold = useRef({ hover: false, focus: false });
  const [autoplay] = useState(() =>
    Autoplay({
      delay: autoplayDelay,
      playOnInit: false,
      stopOnInteraction: false,
      stopOnMouseEnter: false,
      stopOnFocusIn: false,
    }),
  );

  const sync = useCallback(() => {
    if (!api || total < 2) return;
    const shouldPlay = !paused && !hold.current.hover && !hold.current.focus;
    if (shouldPlay && !autoplay.isPlaying()) autoplay.play();
    if (!shouldPlay && autoplay.isPlaying()) autoplay.stop();
  }, [api, autoplay, paused, total]);

  useEffect(() => {
    if (!api) return;
    // Cada cambio de diapositiva (automático o a mano) reinicia el tiempo de la siguiente.
    const onSelect = () => {
      setActive(api.selectedScrollSnap());
      autoplay.reset();
    };
    onSelect();
    api.on('select', onSelect).on('reInit', onSelect);
    // Al soltar un arrastre el complemento reanuda el avance; si debe seguir quieto, se detiene.
    api.on('pointerUp', sync);
    sync();
    return () => {
      api.off('select', onSelect).off('reInit', onSelect).off('pointerUp', sync);
    };
  }, [api, autoplay, sync]);

  return (
    <Carousel
      setApi={setApi}
      opts={{ loop: true }}
      plugins={[autoplay]}
      aria-label={label}
      className={cn('h-full w-full *:data-[slot=carousel-content]:h-full', className)}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'mouse') return;
        hold.current.hover = true;
        sync();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        hold.current.hover = false;
        sync();
      }}
      onFocus={() => {
        hold.current.focus = true;
        sync();
      }}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        hold.current.focus = false;
        sync();
      }}
    >
      {/* Mientras avanza solo no se anuncia cada cambio; en pausa, sí. */}
      <CarouselContent className="ml-0 h-full" aria-live={paused ? 'polite' : 'off'}>
        {slides.map((slide, index) => (
          <CarouselItem
            key={index}
            aria-label={`${index + 1} de ${total}`}
            className="relative h-full pl-0"
          >
            {slide}
          </CarouselItem>
        ))}
      </CarouselContent>
      {/* Arriba a la derecha: abajo los tapaba el botón flotante de WhatsApp. */}
      {total > 1 && (
        <div className="absolute right-5 top-5 z-20 flex items-center gap-1.5 max-[600px]:right-4 max-[600px]:top-4">
          <Button
            variant="light"
            size="icon"
            onClick={() => setUserPaused(!paused)}
            aria-label={paused ? 'Reanudar el avance automático' : 'Pausar el avance automático'}
            className={controlClass}
          >
            {paused ? <Play size={16} /> : <Pause size={16} />}
          </Button>
          <CarouselPrevious variant="light" className={cn(controlClass, 'max-[600px]:hidden')} />
          <div className="flex h-10 items-center rounded-full bg-paper/90 px-1">
            {slides.map((_, index) => (
              <Button
                key={index}
                variant="ghost"
                size="icon"
                onClick={() => api?.scrollTo(index)}
                aria-label={`Ver diapositiva ${index + 1} de ${total}`}
                aria-current={index === active ? 'true' : undefined}
                className="h-10 w-7 min-h-0 rounded-none p-0 enabled:hover:translate-y-0 enabled:hover:bg-transparent"
              >
                <span
                  className={cn(
                    'block h-1.5 rounded-full bg-mauve-dark/35 transition-[width,background-color] duration-300',
                    index === active ? 'w-5 bg-mauve-dark' : 'w-1.5',
                  )}
                />
              </Button>
            ))}
          </div>
          <CarouselNext variant="light" className={cn(controlClass, 'max-[600px]:hidden')} />
        </div>
      )}
    </Carousel>
  );
}
