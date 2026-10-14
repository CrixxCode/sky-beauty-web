import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Replica .field input del prototipo.
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'min-h-11.25 w-full rounded-none border border-field-border bg-white px-3.5 py-3.25 text-[11px] text-ink outline-offset-2 focus:border-field-focus max-[600px]:text-base store:min-[601px]:text-xs aria-invalid:border-danger-border disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
