'use client';

import { AlertCircle, ArrowRight, ShoppingBag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { serifClass } from '@/components/ui/typography';
import { formatCOP } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CartQuoteItem } from '@/types/checkout';
import { useCart } from './cart-context';
import { OrderSummary } from './order-summary';
import { QuantityStepper } from './quantity-stepper';
import { useCartQuote } from './use-cart-quote';

/** Aviso de la línea, sin revelar cuántas unidades hay en existencia. */
function issueMessage(item: CartQuoteItem): string | null {
  if (item.issue === 'OVER_MAX_PER_ORDER') {
    return `Puedes pedir máximo ${item.maxPerOrder} unidades de este producto por pedido.`;
  }
  if (item.issue === 'INSUFFICIENT_STOCK') {
    return item.maxQuantity > 0
      ? 'No hay existencias suficientes para esta cantidad.'
      : 'Este producto se agotó.';
  }
  return null;
}

const removeButton =
  'min-h-11 gap-1.75 px-2 text-xs font-normal text-[#7e6073] not-disabled:hover:bg-[#faf1fa]';

export function CartPage() {
  const { items, ready, updateItem, removeItem, restoreItem } = useCart();
  const quoteQuery = useCartQuote(items);
  const quote = quoteQuery.data ?? null;
  // Mientras se recalcula se muestra la cotización anterior; las cantidades salen de la bolsa
  // para que el selector responda al instante y no se acumulen clics sobre un valor viejo.
  const quantities = new Map(items.map((item) => [item.variantId, item.quantity]));
  const quoteItems = (quote?.items ?? []).filter((item) => quantities.has(item.variantId));
  const unavailable = (quote?.unavailableVariantIds ?? []).filter((id) => quantities.has(id));

  function remove(item: CartQuoteItem) {
    const index = items.findIndex((line) => line.variantId === item.variantId);
    if (index < 0) return;
    const line = items[index];
    removeItem(item.variantId);
    toast(`Quitamos ${item.productName} de tu bolsa.`, {
      action: { label: 'Deshacer', onClick: () => restoreItem(line, index) },
    });
  }

  if (!ready || (items.length > 0 && !quote && quoteQuery.isPending)) {
    return (
      // Reserva el alto del contenido que viene (bolsa vacía o formulario) para que el pie no
      // salte al terminar de cargar (CLS).
      <p role="status" className="min-h-75 text-xs text-muted">
        Cargando tu bolsa…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto my-8.75 flex max-w-140 flex-col items-center bg-[#faf6f8] px-6 py-15 text-center">
        <h2 className={cn(serifClass, 'mb-2.5 text-balance text-[38px] max-[600px]:text-[32px]')}>
          Tu bolsa espera algo especial
        </h2>
        <p className="mb-6 max-w-96 text-xs leading-[1.85] text-[#72646a]">
          Aún no has agregado productos. Encuentra tus próximos favoritos en el catálogo.
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
    <div className="grid grid-cols-[1fr_345px] items-start gap-15 max-[850px]:grid-cols-[1fr_320px] max-[850px]:gap-7.5 max-[600px]:grid-cols-1">
      <div aria-busy={quoteQuery.isFetching}>
        <p role="status" className="h-5 text-xs text-muted">
          {quoteQuery.isFetching ? 'Actualizando precios…' : ''}
        </p>
        {quoteQuery.isError && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-danger-border bg-danger-bg px-3.5 py-2.5 text-xs text-danger"
          >
            No pudimos revisar tu bolsa. Revisa tu conexión e intenta de nuevo.
            <Button
              variant="outline"
              size="sm"
              onClick={() => void quoteQuery.refetch()}
              disabled={quoteQuery.isFetching}
            >
              Reintentar
            </Button>
          </div>
        )}
        {unavailable.map((variantId) => (
          <div
            key={variantId}
            role="alert"
            className="flex items-center justify-between gap-3 border-b border-[#eee6e9] py-4 text-xs text-[#98566f]"
          >
            <span className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" /> Un producto de tu bolsa ya no está
              disponible.
            </span>
            <Button
              variant="ghost"
              onClick={() => removeItem(variantId)}
              className={removeButton}
              aria-label="Quitar de la bolsa el producto no disponible"
            >
              <Trash2 size={16} /> Quitar
            </Button>
          </div>
        ))}
        {quoteItems.map((item) => {
          const issue = issueMessage(item);
          const quantity = quantities.get(item.variantId) ?? item.quantity;
          return (
            <article
              key={item.variantId}
              className="relative flex gap-4.5 border-b border-[#eee6e9] py-5.5 max-[600px]:gap-3.25"
            >
              {/* La foto repite el enlace del nombre: fuera del orden del teclado. */}
              <Link
                href={`/producto/${item.productSlug}`}
                tabIndex={-1}
                aria-hidden="true"
                className="grid h-36.25 w-32.5 shrink-0 place-items-center bg-[#f6f0f1] text-[#7c5f7e] max-[600px]:h-31.25 max-[600px]:w-24"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    width={130}
                    height={145}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ShoppingBag size={26} strokeWidth={1.4} />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <h2 className="mb-1.5 text-sm font-semibold text-[#3f333c] max-[600px]:text-[13px]">
                  <Link
                    href={`/producto/${item.productSlug}`}
                    className="line-clamp-2 wrap-break-word hover:text-[#70436f]"
                  >
                    {item.productName}
                  </Link>
                </h2>
                <p className="text-xs text-[#70656b]">Variante: {item.variantName}</p>
                <p className="mt-0.5 text-xs text-[#70656b]">
                  Ref. <span translate="no">{item.sku}</span>
                </p>
                <p className="mt-2 tabular-nums">
                  <strong className="text-xs">{formatCOP(item.unitFinalPrice)}</strong>
                  {item.unitDiscount > 0 && (
                    <del className="ml-2 text-xs text-[#6e6568]">
                      {formatCOP(item.unitListPrice)}
                    </del>
                  )}
                </p>
                <div className="mt-3.25 flex flex-wrap items-center gap-x-6.25 gap-y-2 max-[600px]:gap-x-3">
                  <QuantityStepper
                    value={quantity}
                    max={Math.max(quantity, item.maxQuantity)}
                    onChange={(next) => updateItem(item.variantId, next)}
                    label={item.productName}
                  />
                  <Button
                    variant="ghost"
                    onClick={() => remove(item)}
                    className={removeButton}
                    aria-label={`Eliminar ${item.productName} de la bolsa`}
                  >
                    <Trash2 size={16} /> Eliminar
                  </Button>
                </div>
                <p className="mt-2 hidden text-xs tabular-nums text-[#50414a] max-[600px]:block">
                  Subtotal: <strong>{formatCOP(item.lineTotal)}</strong>
                </p>
                {issue && (
                  <div
                    role="alert"
                    className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#98566f]"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertCircle size={15} className="shrink-0" /> {issue}
                    </span>
                    {item.maxQuantity > 0 && (
                      <Button
                        variant="link"
                        className="min-h-0 p-0 text-xs"
                        onClick={() => updateItem(item.variantId, item.maxQuantity)}
                      >
                        Ajustar cantidad
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <strong className="whitespace-nowrap text-xs tabular-nums max-[600px]:hidden">
                {formatCOP(item.lineTotal)}
              </strong>
            </article>
          );
        })}
        <Link
          className="mt-8 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#794b79] hover:text-[#5b365b]"
          href="/productos"
        >
          Seguir explorando <ArrowRight size={16} />
        </Link>
      </div>
      <OrderSummary quote={quote} updating={quoteQuery.isPlaceholderData} />
    </div>
  );
}
