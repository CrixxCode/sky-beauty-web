'use client';

import { Minus, Plus, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PublicVariant } from '@/types/catalog';
import { useCart } from './cart-context';

export function AddToCartControls({ variant }: { variant: PublicVariant | null }) {
  const { addItem } = useCart();
  const max = variant ? Math.min(variant.stock, variant.maxPerOrder ?? variant.stock) : 0;
  const [quantity, setQuantity] = useState(1);
  const disabled = !variant || max <= 0;

  function update(next: number) {
    setQuantity(Math.min(max || 1, Math.max(1, next)));
  }

  return (
    <div className="my-8 flex flex-wrap items-center gap-2.5">
      <div className="flex h-11.25 w-30 items-center justify-between border border-[#e2d8df]">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => update(quantity - 1)}
          disabled={disabled || quantity <= 1}
          className="h-full min-h-0 w-9 rounded-none p-0 text-[#6d5868] enabled:hover:translate-y-0 enabled:hover:bg-transparent"
          aria-label="Disminuir cantidad"
        >
          <Minus size={15} />
        </Button>
        <span className="text-xs font-semibold">{quantity}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => update(quantity + 1)}
          disabled={disabled || quantity >= max}
          className="h-full min-h-0 w-9 rounded-none p-0 text-[#6d5868] enabled:hover:translate-y-0 enabled:hover:bg-transparent"
          aria-label="Aumentar cantidad"
        >
          <Plus size={15} />
        </Button>
      </div>
      <Button
        disabled={disabled}
        onClick={() => {
          if (variant) addItem(variant.id, quantity);
        }}
        className={cn('min-w-52 max-[600px]:min-w-0 max-[600px]:flex-1')}
      >
        <ShoppingBag size={17} />
        Agregar a la bolsa
      </Button>
    </div>
  );
}
