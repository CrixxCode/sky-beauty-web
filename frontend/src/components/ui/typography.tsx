import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Antetítulo en mayúsculas (replica .eyebrow del prototipo). */
export function Eyebrow({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn(
        'text-[10px] font-bold uppercase leading-[1.8] tracking-[.22em] text-eyebrow store:text-xs',
        className,
      )}
      {...props}
    />
  );
}

/** Clases de los títulos con Playfair Display (replica .serif del prototipo). */
export const serifClass = 'font-serif font-medium tracking-[-.045em]';

/** Enlace de acción con flecha (replica .text-action del prototipo). */
export function TextAction({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        'inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap text-xs font-semibold text-[#794b79] hover:text-[#5b365b] [&>svg]:transition-transform hover:[&>svg]:translate-x-1.5',
        className,
      )}
      {...props}
    />
  );
}
