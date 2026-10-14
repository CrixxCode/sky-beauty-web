import * as React from 'react';
import { Slot } from 'radix-ui';
import { cn } from '@/lib/utils';

// Ruta de navegación de shadcn/ui con los colores del proyecto.
function Breadcrumb({
  'aria-label': ariaLabel = 'Ruta de navegación',
  ...props
}: React.ComponentProps<'nav'>) {
  return <nav aria-label={ariaLabel} {...props} />;
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      className={cn(
        'flex flex-wrap items-center gap-x-2.5 gap-y-1 wrap-break-word text-xs text-[#6f6168]',
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('inline-flex min-w-0 items-center', className)} {...props} />;
}

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'a';
  return <Comp className={cn('transition-colors hover:text-[#5d405b]', className)} {...props} />;
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span aria-current="page" className={cn('truncate text-[#3f333c]', className)} {...props} />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li role="presentation" aria-hidden="true" className={className} {...props}>
      {children ?? '/'}
    </li>
  );
}

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
