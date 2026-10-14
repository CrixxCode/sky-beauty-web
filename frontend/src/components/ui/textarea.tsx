import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Replica .field textarea del prototipo.
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-11.25 w-full resize-y rounded-none border border-field-border bg-white px-3.5 py-3.25 text-[11px] text-ink outline-offset-2 focus:border-field-focus max-[600px]:text-base store:min-[601px]:text-xs aria-invalid:border-danger-border disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
