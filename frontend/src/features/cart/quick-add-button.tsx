'use client';

import { Check, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCart } from './cart-context';

/** Cuánto se muestra el check después de agregar, antes de volver al "+". */
const ADDED_MS = 1200;

// Los dos íconos ocupan la misma celda y se funden entre sí; el leve desenfoque hace que se vean
// como un solo ícono que se transforma y no como dos que se intercambian.
const iconSwap =
  'col-start-1 row-start-1 transition-[opacity,filter,scale] duration-200 ease-out-strong';
const iconHidden = 'scale-75 opacity-0 blur-[2px]';

/**
 * Agrega una unidad desde la tarjeta del producto (replica .add-mini del prototipo). Solo se usa
 * en productos con una única variante: con varias, el cliente elige la suya en el detalle.
 * El máximo combina existencias y límite por pedido, igual que en el detalle.
 */
export function QuickAddButton({
  productName,
  variantId,
  stock,
  maxPerOrder,
}: {
  productName: string;
  variantId: string;
  stock: number;
  maxPerOrder: number | null;
}) {
  const { addItem } = useCart();
  const max = Math.min(stock, maxPerOrder ?? stock);
  const disabled = max <= 0;
  const [added, setAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function onClick() {
    if (!addItem(variantId, 1, max)) return;
    setAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), ADDED_MS);
  }

  return (
    <Button
      variant="secondary"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      aria-label={disabled ? `${productName}: agotado` : `Agregar ${productName} a la bolsa`}
      className="h-11 w-11 shrink-0"
    >
      <span aria-hidden="true" className="grid place-items-center">
        <Plus size={19} className={cn(iconSwap, added && iconHidden)} />
        <Check size={19} className={cn(iconSwap, !added && iconHidden)} />
      </span>
    </Button>
  );
}
