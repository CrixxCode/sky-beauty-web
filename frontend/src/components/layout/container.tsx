import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Ancho y márgenes laterales de las páginas (replica .container del prototipo). */
export function Container({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mx-auto w-[min(100%-34px,1280px)] min-[601px]:w-[min(100%-36px,1280px)] min-[851px]:w-[min(100%-50px,1280px)] min-[1151px]:w-[min(100%-72px,1280px)]',
        className,
      )}
      {...props}
    />
  );
}
