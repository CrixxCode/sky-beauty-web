import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Paginación de shadcn/ui con enlaces de Next.js y los estilos del proyecto.
function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="Paginación"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  );
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul className={cn('flex flex-wrap items-center gap-1', className)} {...props} />;
}

function PaginationItem(props: React.ComponentProps<'li'>) {
  return <li {...props} />;
}

type PaginationLinkProps = { isActive?: boolean } & React.ComponentProps<typeof Link>;

function PaginationLink({ className, isActive, ...props }: PaginationLinkProps) {
  return (
    <Link
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        buttonVariants({ variant: isActive ? 'outline' : 'ghost', size: 'icon' }),
        'tabular-nums',
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      aria-label="Página anterior"
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1 px-3', className)}
      {...props}
    >
      <ChevronLeft size={16} />
      <span className="max-[600px]:sr-only">Anterior</span>
    </Link>
  );
}

function PaginationNext({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      aria-label="Página siguiente"
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1 px-3', className)}
      {...props}
    >
      <span className="max-[600px]:sr-only">Siguiente</span>
      <ChevronRight size={16} />
    </Link>
  );
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex h-11.25 w-8 items-center justify-center text-[#6f6168]', className)}
      {...props}
    >
      <MoreHorizontal size={16} />
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
