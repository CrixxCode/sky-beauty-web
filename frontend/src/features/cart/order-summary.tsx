'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCOP } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CartQuote } from '@/types/checkout';

/** Texto del envío: por confirmar (sin tarifa), gratis o el valor calculado. */
export function shippingText(shippingCost: number | null | undefined): string {
  if (shippingCost === null || shippingCost === undefined) return 'Por confirmar';
  return shippingCost === 0 ? 'Gratis' : formatCOP(shippingCost);
}

export function OrderSummary({
  quote,
  checkout = false,
  updating = false,
}: {
  quote: CartQuote | null;
  checkout?: boolean;
  /** Se muestra la cotización anterior mientras llega la nueva. */
  updating?: boolean;
}) {
  return (
    <aside
      id="resumen"
      aria-busy={updating}
      className="sticky top-6 scroll-mt-6 border border-[#f0e7ed] bg-[#f8f4f4] p-6.75 max-[850px]:static"
    >
      <h2 className="mb-6 font-serif text-[25px] leading-tight">Resumen de tu pedido</h2>
      <div className={cn('transition-opacity', updating && 'opacity-60')}>
        {checkout && quote && (
          <div className="mb-4 border-b border-[#e9dfe4] pb-3.5">
            {quote.items.map((item) => (
              <div key={item.variantId} className="mb-3.5 flex items-center gap-2.5 text-xs">
                <div className="h-11.5 w-10.75 shrink-0 bg-[#f1e8ee]">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      width={43}
                      height={46}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <span className="min-w-0 flex-1 wrap-break-word">
                  {item.productName}
                  <small className="block text-xs text-[#72656e]">
                    {item.variantName} · Cant. {item.quantity}
                  </small>
                </span>
                <strong className="tabular-nums">{formatCOP(item.lineTotal)}</strong>
              </div>
            ))}
          </div>
        )}
        <SummaryRow label="Subtotal" value={quote ? formatCOP(quote.subtotal) : '—'} />
        {quote && quote.discountTotal > 0 && (
          <SummaryRow label="Descuentos" value={`−${formatCOP(quote.discountTotal)}`} />
        )}
        <SummaryRow label="Envío" value={shippingText(quote?.shippingCost)} />
        <div className="mt-5.75 flex items-center justify-between gap-3 border-t border-[#e5d9e2] pt-5.5 text-[13px] font-semibold">
          <span>{quote?.shippingCost === null ? 'Total sin envío' : 'Total'}</span>
          <strong className="text-[19px] tabular-nums">
            {quote ? formatCOP(quote.total) : '—'}
          </strong>
        </div>
      </div>
      <p className="my-6 text-xs leading-[1.8] text-[#70656b]">
        {checkout
          ? 'Si tu municipio no tiene tarifa de envío configurada, la tienda te confirma el valor por WhatsApp.'
          : 'El envío se calcula en el checkout según tu municipio.'}
      </p>
      {!checkout && quote && quote.items.length > 0 && (
        <>
          {quote.canCheckout ? (
            <Button asChild className="w-full">
              <Link href="/checkout">
                Continuar al checkout <ArrowRight size={17} />
              </Link>
            </Button>
          ) : (
            <Button className="w-full" disabled aria-describedby="checkout-blocked">
              Continuar al checkout <ArrowRight size={17} />
            </Button>
          )}
          {!quote.canCheckout && (
            <p id="checkout-blocked" className="mt-3 text-xs text-[#98566f]">
              Revisa los avisos de tu bolsa para continuar.
            </p>
          )}
        </>
      )}
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="my-4 flex items-center justify-between gap-3 text-xs text-[#6a6166]">
      <span>{label}</span>
      <strong className="text-xs tabular-nums text-[#50414a]">{value}</strong>
    </div>
  );
}
