import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

// Replica .btn, .btn-primary, .btn-outline y .btn-light del prototipo (src/styles.css)
// con la arquitectura y compatibilidad oficial de shadcn/ui. A diferencia del prototipo, no se
// levanta al pasar el cursor: se hunde al presionar, una respuesta que también se siente en celular.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[3px] font-semibold tracking-[.015em] transition-[background-color,border-color,color,scale] duration-150 ease-out-strong not-disabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        primary: 'border border-mauve-dark bg-mauve-dark text-white not-disabled:hover:bg-mauve-deep',
        default: 'border border-mauve-dark bg-mauve-dark text-white not-disabled:hover:bg-mauve-deep',
        outline: 'border border-[#ac88a9] bg-transparent text-[#5d405b] not-disabled:hover:bg-[#faf1fa]',
        light: 'bg-[#fffaf7] text-[#56365c]',
        secondary: 'bg-[#f4ebf4] text-[#764b77] not-disabled:hover:bg-[#ebd9eb]',
        ghost: 'bg-transparent text-[#5d405b] not-disabled:hover:bg-[#faf1fa]',
        destructive: 'border border-danger bg-danger text-white not-disabled:hover:bg-[#7e3445]',
        link: 'h-auto min-h-0 p-0 text-[#764b77] underline-offset-4 not-disabled:active:scale-100 not-disabled:hover:underline',
      },
      size: {
        md: 'min-h-11.25 px-6.25 py-3 text-xs',
        default: 'min-h-11.25 px-6.25 py-3 text-xs',
        sm: 'min-h-11.25 px-4 py-2 text-[11px] store:text-xs',
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
