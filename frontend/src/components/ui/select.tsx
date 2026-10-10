import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Replica .field select del prototipo.
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'min-h-11.25 w-full rounded-none border border-field-border bg-white px-3.5 py-3.25 text-[11px] text-ink outline-offset-2 focus:border-field-focus disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
