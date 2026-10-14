'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from './cart-context';

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

  return (
    <Button
      variant="secondary"
      size="icon"
      disabled={disabled}
      onClick={() => addItem(variantId, 1, max)}
      aria-label={disabled ? `${productName}: agotado` : `Agregar ${productName} a la bolsa`}
      className="h-11 w-11 shrink-0"
    >
      <Plus size={19} />
    </Button>
  );
}
