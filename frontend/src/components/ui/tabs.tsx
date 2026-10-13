'use client';

import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

// Pestañas de shadcn/ui con el estilo de las pestañas del panel del prototipo.
function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn('flex flex-col gap-4', className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('inline-flex flex-wrap border border-[#e8dfe6] bg-white p-0.5', className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#625760] transition-colors hover:text-[#493a45] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b785b8] disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:bg-[#764b77] data-[state=active]:font-semibold data-[state=active]:text-white',
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('outline-none', className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
