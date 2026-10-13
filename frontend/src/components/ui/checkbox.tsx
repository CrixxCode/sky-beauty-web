'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

// Casilla de shadcn/ui con los colores del proyecto.
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer grid size-4 shrink-0 cursor-pointer place-items-center rounded-[3px] border border-[#c5bcc3] bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b785b8] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger-border data-[state=checked]:border-[#a46ea4] data-[state=checked]:bg-[#a46ea4] data-[state=checked]:text-white',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check size={12} strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
