import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Grupo de campo de shadcn/ui (campo con icono y botón dentro del mismo borde),
// con el estilo de los buscadores del panel del prototipo.
function InputGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="group"
      className={cn(
        'relative flex min-h-11.25 items-center border border-[#e8dfe6] bg-white text-[#917987] transition-colors focus-within:border-[#936591]',
        className,
      )}
      {...props}
    />
  );
}

function InputGroupAddon({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('flex items-center pl-3 text-[#917987]', className)} {...props} />;
}

function InputGroupInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      className={cn(
        'min-h-11.25 flex-1 border-0 bg-transparent px-2.5 py-0 outline-none placeholder:text-[#a0929b] focus:border-0',
        className,
      )}
      {...props}
    />
  );
}

function InputGroupButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        'h-11.25 w-9 rounded-none text-[#a0929b] enabled:hover:translate-y-0 enabled:hover:bg-transparent enabled:hover:text-[#493a45]',
        className,
      )}
      {...props}
    />
  );
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput };
