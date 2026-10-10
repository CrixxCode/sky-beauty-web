import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Antetítulo en mayúsculas (replica .eyebrow del prototipo). */
export function Eyebrow({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      className={cn(
        'text-[10px] font-bold uppercase leading-[1.8] tracking-[.22em] text-eyebrow',
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
        'inline-flex items-center gap-2.5 text-xs font-semibold text-[#794b79] transition-[gap] hover:gap-4',
        className,
      )}
      {...props}
    />
  );
}
