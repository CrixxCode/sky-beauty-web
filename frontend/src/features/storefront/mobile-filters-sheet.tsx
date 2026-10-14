'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

/**
 * Botón "Filtros" del catálogo en celular: abre los mismos filtros de la barra lateral de
 * escritorio. Se cierra al elegir un filtro o al buscar, porque la página cambia de resultados.
 */
export function MobileFiltersSheet({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="hidden max-[600px]:inline-flex">
          <SlidersHorizontal size={16} />
          Filtros
          {activeCount > 0 && <span className="tabular-nums">({activeCount})</span>}
        </Button>
      </SheetTrigger>
      {/* Sin foco automático en el buscador: en el celular abriría el teclado al abrir el panel. */}
      <SheetContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
      >
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Elige una categoría o una marca, o busca por nombre.</SheetDescription>
        </SheetHeader>
        <div
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest('a')) setOpen(false);
          }}
          onSubmitCapture={() => setOpen(false)}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
