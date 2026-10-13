'use client';

import * as React from 'react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

// Grupo de opciones de shadcn/ui con los colores del proyecto.
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root className={cn('grid gap-2.75', className)} {...props} />;
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'grid size-4 shrink-0 cursor-pointer place-items-center rounded-full border border-[#c5bcc3] bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b785b8] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-[#a46ea4]',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-[#a46ea4]" />
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
