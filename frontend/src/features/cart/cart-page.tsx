'use client';

import { ArrowRight, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { serifClass } from '@/components/ui/typography';
import { Input } from '@/components/ui/input';
import { formatCOP } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCart } from './cart-context';
import { OrderSummary } from './order-summary';
import { useCartQuote } from './use-cart-quote';

export function CartPage() {
  const { items, updateItem, removeItem } = useCart();
  const quoteQuery = useCartQuote(items);
  const quote = quoteQuery.data ?? null;

  if (items.length === 0) {
    return (
      <div className="mx-auto my-8.75 flex max-w-140 flex-col items-center bg-[#faf6f8] px-6 py-15 text-center">
        <h1 className={cn(serifClass, 'mb-2.5 text-[38px]')}>Tu bolsa espera algo especial</h1>
        <p className="mb-6 max-w-96 text-xs leading-[1.85] text-[#88777e]">
          Aun no has agregado productos. Encuentra tus proximos favoritos en el catalogo.
        </p>
        <Button asChild>
          <Link href="/productos">
            Explorar productos <ArrowRight size={16} />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_345px] gap-15 max-[850px]:grid-cols-1 max-[850px]:gap-7.5">
      <div>
        {quoteQuery.isPending && <p className="text-[11px] text-muted">Actualizando precios...</p>}
        {quoteQuery.isError && (
          <p className="mb-4 border border-danger-border bg-danger-bg px-3 py-2 text-[11px] text-danger">
            No se pudo validar el carrito. Revisa disponibilidad o intenta de nuevo.
          </p>
        )}
        {(quote?.items ?? []).map((item) => (
          <article key={item.variantId} className="relative flex gap-4.5 border-b border-[#eee6e9] py-5.5">
            <Link href={`/producto/${item.productSlug}`} className="block h-36.25 w-32.5 shrink-0 bg-[#f6f0f1] max-[600px]:h-31.25 max-[600px]:w-24">
              {item.imageUrl ? <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" /> : null}
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#9b7099]">{item.sku}</p>
              <Link href={`/producto/${item.productSlug}`}>
                <h2 className="my-2 text-sm font-semibold text-[#3f333c] max-[600px]:text-[11px]">
                  {item.productName}
                </h2>
              </Link>
              <p className="text-[11px] text-[#81747b]">Variante: {item.variantName}</p>
              <strong className="mt-2 block text-xs">{formatCOP(item.unitFinalPrice)}</strong>
              <div className="mt-3.25 flex flex-wrap items-center gap-4">
                <Input
                  type="number"
                  min={1}
                  max={item.maxPerOrder ?? item.stock}
                  value={item.quantity}
                  onChange={(event) => updateItem(item.variantId, Number(event.target.value))}
                  className="h-9.5 min-h-0 w-20 border-[#e2d8df] px-2 py-0 text-center"
                  aria-label={`Cantidad de ${item.productName}`}
                />
                <Button
                  variant="ghost"
                  onClick={() => removeItem(item.variantId)}
                  className="min-h-0 gap-1.75 p-0 text-[11px] font-normal text-[#9a758c] enabled:hover:translate-y-0 enabled:hover:bg-transparent"
                >
                  <Trash2 size={16} /> Eliminar
                </Button>
              </div>
            </div>
            <strong className="text-xs max-[600px]:hidden">{formatCOP(item.lineTotal)}</strong>
          </article>
        ))}
        <Link className="mt-8 inline-flex items-center gap-2 text-xs font-semibold text-[#794b79]" href="/productos">
          Seguir explorando <ArrowRight size={16} />
        </Link>
      </div>
      <OrderSummary quote={quote} />
    </div>
  );
}
