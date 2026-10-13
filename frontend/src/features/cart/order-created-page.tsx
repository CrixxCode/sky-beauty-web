'use client';

import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCOP } from '@/lib/format';
import type { CreatedOrder } from '@/types/checkout';

function readOrder(code: string): CreatedOrder | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`sky-beauty-order-${code}`);
    return raw ? (JSON.parse(raw) as CreatedOrder) : null;
  } catch {
    return null;
  }
}

export function OrderCreatedPage({ code }: { code: string }) {
  const [order] = useState<CreatedOrder | null>(() => readOrder(code));
  const summary = order?.summary;

  return (
    <div className="mx-auto my-10 max-w-165 bg-[#faf5fa] px-6 py-15 text-center">
      <CheckCircle2 size={55} className="mx-auto mb-5 text-[#9b7199]" />
      <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#9b7099]">
        Pedido registrado
      </p>
      <h1 className="font-serif mx-auto mb-5 mt-1.5 text-[45px] leading-[1.2] max-[600px]:text-[36px]">
        Envía tu pedido por WhatsApp para continuar
      </h1>
      <p className="mx-auto mb-7 max-w-130 text-xs leading-[2] text-[#786b74]">
        Tu código de pedido es <strong>{code}</strong>. La tienda lo confirma cuando recibe tu
        mensaje; el pago se verifica según el método elegido.
      </p>
      {summary && (
        <div className="mx-auto mb-7 max-w-110 border border-[#eaddea] bg-white p-4 text-left text-[11px]">
          {summary.items.map((item) => (
            <div
              key={`${item.productName}-${item.variantName}`}
              className="mb-2 flex justify-between gap-3"
            >
              <span>
                {item.productName}
                <small className="block text-[#90808b]">
                  {item.variantName} · Cant. {item.quantity}
                </small>
              </span>
              <span>{formatCOP(item.lineTotal)}</span>
            </div>
          ))}
          <div className="mt-3 flex justify-between gap-3 border-t border-[#f0e7ed] pt-3 text-[#7f737b]">
            <span>Envío</span>
            <span>
              {summary.shippingCost === null
                ? 'Por confirmar'
                : summary.shippingCost === 0
                  ? 'Gratis'
                  : formatCOP(summary.shippingCost)}
            </span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span>{summary.shippingCost === null ? 'Total sin envío' : 'Total'}</span>
            <strong>{formatCOP(summary.total)}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[#7f737b]">
            <span>Método de pago</span>
            <span>{summary.paymentMethodName}</span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {order?.whatsappUrl && (
          <Button asChild>
            <a href={order.whatsappUrl} target="_blank" rel="noreferrer">
              <MessageCircle size={17} />
              Abrir WhatsApp
            </a>
          </Button>
        )}
        {order && (
          <Button asChild variant="outline">
            <Link href={order.trackingPath}>
              Ver el estado de mi pedido <ArrowRight size={16} />
            </Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/productos">Volver al catálogo</Link>
        </Button>
      </div>
      {order && !order.whatsappUrl && (
        <p className="mt-6 text-[11px] text-[#8b7f87]">
          La tienda aún no tiene un número de WhatsApp configurado. Guarda tu código de pedido.
        </p>
      )}
      {order && (
        <p className="mt-6 text-[11px] text-[#8b7f87]">
          Guarda el enlace del estado de tu pedido: es privado y no necesitas cuenta para verlo.
        </p>
      )}
      {!order && (
        <p className="mt-6 text-[11px] text-[#8b7f87]">
          Este resumen solo se muestra en el navegador donde hiciste el pedido.
        </p>
      )}
    </div>
  );
}
