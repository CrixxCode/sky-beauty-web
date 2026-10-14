'use client';

import { ArrowRight, CheckCircle2, Copy, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatCOP } from '@/lib/format';
import type { CreatedOrder } from '@/types/checkout';
import { shippingText } from './order-summary';

// El resumen se guarda en sessionStorage al crear el pedido y no cambia después: no hay a qué
// suscribirse. En el servidor (y al hidratar) vale `undefined`, "aún no se sabe", para que el
// primer render coincida con el del servidor sin mostrar por un instante el aviso de "sin resumen".
const subscribe = () => () => {};

function readRaw(code: string): string | null {
  try {
    return sessionStorage.getItem(`sky-beauty-order-${code}`);
  } catch {
    return null;
  }
}

function parseOrder(raw: string | null): CreatedOrder | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CreatedOrder;
  } catch {
    return null;
  }
}

export function OrderCreatedPage({ code }: { code: string }) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(code),
    () => undefined,
  );
  const loaded = raw !== undefined;
  const order = useMemo(() => parseOrder(raw ?? null), [raw]);
  const summary = order?.summary;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Código copiado.');
    } catch {
      toast.error('No pudimos copiar el código. Selecciónalo y cópialo a mano.');
    }
  }

  return (
    <div className="mx-auto my-10 max-w-165 bg-[#faf5fa] px-6 py-15 text-center max-[600px]:my-4 max-[600px]:px-4.5 max-[600px]:py-10">
      <CheckCircle2 size={55} className="mx-auto mb-5 text-[#7f5d7d]" />
      <p className="text-xs font-bold uppercase tracking-[.22em] text-[#815d7f]">
        Pedido registrado
      </p>
      <h1 className="mx-auto mb-5 mt-1.5 text-balance font-serif text-[45px] leading-[1.2] max-[600px]:text-[32px]">
        Envía tu pedido por WhatsApp para continuar
      </h1>
      <div className="mx-auto mb-3 flex flex-wrap items-center justify-center gap-2 text-sm">
        <span>Tu código de pedido es</span>
        <strong translate="no" className="select-all tracking-wide">
          {code}
        </strong>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void copyCode()}
          aria-label="Copiar el código del pedido"
          className="enabled:hover:translate-y-0"
        >
          <Copy size={16} />
        </Button>
      </div>
      <p className="mx-auto mb-7 max-w-130 text-pretty text-xs leading-loose text-[#6a5e66]">
        La tienda lo confirma cuando recibe tu mensaje; el pago se verifica según el método elegido.
      </p>
      {summary && (
        <div className="mx-auto mb-7 max-w-110 border border-[#eaddea] bg-white p-4 text-left text-xs">
          {summary.items.map((item) => (
            <div
              key={`${item.productName}-${item.variantName}`}
              className="mb-2 flex justify-between gap-3"
            >
              <span className="min-w-0 wrap-break-word">
                {item.productName}
                <small className="block text-xs text-[#72656e]">
                  {item.variantName} · Cant. {item.quantity}
                </small>
              </span>
              <span className="tabular-nums">{formatCOP(item.lineTotal)}</span>
            </div>
          ))}
          <div className="mt-3 flex justify-between gap-3 border-t border-[#f0e7ed] pt-3 text-[#6a6166]">
            <span>Envío</span>
            <span className="tabular-nums">{shippingText(summary.shippingCost)}</span>
          </div>
          <div className="mt-2 flex justify-between gap-3">
            <span>{summary.shippingCost === null ? 'Total sin envío' : 'Total'}</span>
            <strong className="tabular-nums">{formatCOP(summary.total)}</strong>
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[#6a6166]">
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
        {loaded && !order && (
          <Button asChild variant="outline">
            <Link href="/rastrear">
              Rastrear mi pedido <ArrowRight size={16} />
            </Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/productos">Volver al catálogo</Link>
        </Button>
      </div>
      {order && !order.whatsappUrl && (
        <p className="mt-6 text-xs text-[#6f666c]">
          La tienda aún no tiene un número de WhatsApp configurado. Guarda tu código de pedido.
        </p>
      )}
      {order && (
        <p className="mt-6 text-xs text-[#6f666c]">
          Guarda el enlace del estado de tu pedido: es privado y no necesitas cuenta para verlo.
        </p>
      )}
      {loaded && !order && (
        <p className="mx-auto mt-6 max-w-120 text-pretty text-xs text-[#6f666c]">
          El resumen solo se muestra en el navegador donde hiciste el pedido. Puedes consultar su
          estado en “Rastrear pedido” con este código y el teléfono de la compra.
        </p>
      )}
    </div>
  );
}
