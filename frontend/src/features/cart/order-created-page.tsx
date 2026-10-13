'use client';

import { ArrowRight, CheckCircle2, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatCOP } from '@/lib/format';
import type { CreatedOrder } from '@/types/checkout';

export function OrderCreatedPage({ code }: { code: string }) {
  const [order] = useState<CreatedOrder | null>(() => {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(`sky-beauty-order-${code}`);
    return raw ? (JSON.parse(raw) as CreatedOrder) : null;
  });

  return (
    <div className="mx-auto my-10 max-w-165 bg-[#faf5fa] px-6 py-15 text-center">
      <CheckCircle2 size={55} className="mx-auto mb-5 text-[#9b7199]" />
      <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#9b7099]">Pedido registrado</p>
      <h1 className="font-serif mx-auto mb-5 mt-1.5 text-[45px] leading-[1.2] max-[600px]:text-[36px]">
        Tu pedido quedo listo para continuar por WhatsApp
      </h1>
      <p className="mx-auto mb-7 max-w-130 text-xs leading-[2] text-[#786b74]">
        Codigo <strong>{code}</strong>. La tienda debe confirmar el pedido, el envio y el pago segun el
        metodo elegido.
      </p>
      {order && (
        <div className="mx-auto mb-7 max-w-110 border border-[#eaddea] bg-white p-4 text-left text-[11px]">
          <div className="flex justify-between gap-3">
            <span>Total de productos</span>
            <strong>{formatCOP(order.quote.total)}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[#7f737b]">
            <span>Envio</span>
            <span>
              {order.quote.shippingCost === null
                ? order.quote.shippingLabel
                : formatCOP(order.quote.shippingCost)}
            </span>
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
              Ver enlace privado <ArrowRight size={16} />
            </Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/productos">Volver al catalogo</Link>
        </Button>
      </div>
      {!order && (
        <p className="mt-6 text-[11px] text-[#8b7f87]">
          Si necesitas abrir WhatsApp, vuelve a crear el pedido desde el carrito en este navegador.
        </p>
      )}
    </div>
  );
}
