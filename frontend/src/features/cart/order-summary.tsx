'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCOP } from '@/lib/format';
import type { CartQuote } from '@/types/checkout';

export function OrderSummary({
  quote,
  checkout = false,
}: {
  quote: CartQuote | null;
  checkout?: boolean;
}) {
  return (
    <aside className="sticky top-6 border border-[#f0e7ed] bg-[#f8f4f4] p-6.75 max-[850px]:static">
      <h2 className="font-serif mb-6 text-[25px] leading-tight">Resumen de tu pedido</h2>
      {checkout && quote && (
        <div className="mb-4 border-b border-[#e9dfe4] pb-3.5">
          {quote.items.map((item) => (
            <div key={item.variantId} className="mb-3.5 flex items-center gap-2.5 text-[10px]">
              <div className="h-11.5 w-10.75 bg-[#f1e8ee]">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <span className="min-w-0 flex-1">
                {item.productName}
                <small className="block text-[#90808b]">
                  {item.variantName} - Cant. {item.quantity}
                </small>
              </span>
              <strong>{formatCOP(item.lineTotal)}</strong>
            </div>
          ))}
        </div>
      )}
      <SummaryRow label="Subtotal" value={quote ? formatCOP(quote.subtotal) : '-'} />
      {quote && quote.discountTotal > 0 && (
        <SummaryRow label="Descuentos" value={`-${formatCOP(quote.discountTotal)}`} />
      )}
      <SummaryRow
        label="Envío"
        value={
          !quote || quote.shippingCost === null
            ? 'Por confirmar'
            : quote.shippingCost === 0
              ? 'Gratis'
              : formatCOP(quote.shippingCost)
        }
      />
      <div className="mt-5.75 flex items-center justify-between gap-3 border-t border-[#e5d9e2] pt-5.5 text-[13px] font-semibold">
        <span>{quote?.shippingCost === null ? 'Total sin envío' : 'Total'}</span>
        <strong className="text-[19px]">{quote ? formatCOP(quote.total) : '-'}</strong>
      </div>
      <p className="my-6 text-[10px] leading-[1.8] text-[#978990]">
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
            <Button className="w-full" disabled>
              Continuar al checkout <ArrowRight size={17} />
            </Button>
          )}
          {!quote.canCheckout && (
            <p className="mt-3 text-[10px] text-[#98566f]">
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
    <div className="my-4 flex items-center justify-between gap-3 text-[11px] text-[#746c71]">
      <span>{label}</span>
      <strong className="text-xs text-[#50414a]">{value}</strong>
    </div>
  );
}
