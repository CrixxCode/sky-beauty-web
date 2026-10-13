import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

// Replica .btn, .btn-primary, .btn-outline y .btn-light del prototipo (src/styles.css)
// con la arquitectura y compatibilidad oficial de shadcn/ui.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[3px] font-semibold tracking-[.015em] transition-[background,transform,border,color] duration-200 enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'border border-mauve-dark bg-mauve-dark text-white enabled:hover:bg-mauve-deep',
        default: 'border border-mauve-dark bg-mauve-dark text-white enabled:hover:bg-mauve-deep',
        outline: 'border border-[#ac88a9] bg-transparent text-[#5d405b] enabled:hover:bg-[#faf1fa]',
        light: 'bg-[#fffaf7] text-[#56365c]',
        secondary: 'bg-[#f4ebf4] text-[#764b77] enabled:hover:bg-[#ebd9eb]',
        ghost: 'bg-transparent text-[#5d405b] enabled:hover:bg-[#faf1fa]',
        destructive: 'border border-danger bg-danger text-white enabled:hover:bg-[#7e3445]',
      },
      size: {
        md: 'min-h-11.25 px-6.25 py-3 text-xs',
        default: 'min-h-11.25 px-6.25 py-3 text-xs',
        sm: 'min-h-11.25 px-4 py-2 text-[11px]',
        icon: 'h-11.25 w-11.25 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = 'button', ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
