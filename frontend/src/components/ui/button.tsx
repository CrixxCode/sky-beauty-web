import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Replica .btn, .btn-primary, .btn-outline y .btn-light del prototipo (src/styles.css).
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-3 rounded-[3px] font-semibold tracking-[.015em] transition-[background,transform,border] duration-200 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'border border-mauve-dark bg-mauve-dark text-white enabled:hover:bg-mauve-deep',
        outline: 'border border-[#ac88a9] bg-transparent text-[#5d405b] enabled:hover:bg-[#faf1fa]',
        light: 'bg-[#fffaf7] text-[#56365c]',
      },
      size: {
        md: 'min-h-12 px-6.25 py-3 text-xs',
        sm: 'min-h-9 px-4 py-2 text-[11px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
