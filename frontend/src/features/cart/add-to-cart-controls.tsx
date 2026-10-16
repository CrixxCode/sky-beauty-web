'use client';

import { ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PublicVariant } from '@/types/catalog';
import { useCart } from './cart-context';
import { QuantityStepper } from './quantity-stepper';

export function AddToCartControls({ variant }: { variant: PublicVariant | null }) {
  const { addItem } = useCart();
  const max = variant ? Math.min(variant.stock, variant.maxPerOrder ?? variant.stock) : 0;
  const [quantity, setQuantity] = useState(1);
  const disabled = !variant || max <= 0;
  // Se informa el máximo por pedido solo cuando es el que limita: si lo limitan las existencias,
  // mostrarlo revelaría la cantidad disponible (decisión del 2026-10-13).
  const perOrderLimit =
    variant?.maxPerOrder != null && variant.maxPerOrder <= variant.stock
      ? variant.maxPerOrder
      : null;

  function update(next: number) {
    setQuantity(Math.min(max || 1, Math.max(1, next)));
  }

  return (
    <div className="my-8">
      <div className="flex flex-wrap items-center gap-2.5">
        <QuantityStepper
          value={quantity}
          max={Math.max(1, max)}
          onChange={update}
          disabled={disabled}
        />
        <Button
          disabled={disabled}
          onClick={() => {
            if (variant) addItem(variant.id, quantity, max);
          }}
          className={cn('min-w-52 max-[600px]:min-w-0 max-[600px]:flex-1')}
        >
          <ShoppingBag size={17} />
          Agregar a la bolsa
        </Button>
      </div>
      {!disabled && perOrderLimit !== null && (
        <p className="mt-2.5 text-xs text-[#6d646a]">
          Máximo {perOrderLimit} {perOrderLimit === 1 ? 'unidad' : 'unidades'} por pedido.
        </p>
      )}
    </div>
  );
}
