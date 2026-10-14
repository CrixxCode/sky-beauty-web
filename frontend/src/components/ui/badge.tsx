import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-semibold store:text-xs',
  {
    variants: {
      variant: {
        default: 'bg-[#f4eff3] text-[#764b77]',
        success: 'bg-success-bg text-success',
        danger: 'bg-out-bg text-out',
        neutral: 'bg-[#f0e0f0] text-[#7d507a]',
        warning: 'bg-amber-100 text-amber-800',
        // .sale-badge del prototipo
        sale: 'bg-[#fff9f8] text-[#94526c]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
