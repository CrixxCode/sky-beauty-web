import { ArrowRight, Clock3, CreditCard, PackageCheck, Truck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchPublicApi } from '@/lib/api.server';
import { formatCOP } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/types/orders-labels';
import { SHIPPING_STATUS_LABELS } from '@/types/shipping';
import type { PublicOrderTracking } from '@/types/tracking';

export const metadata: Metadata = { title: 'Seguimiento' };

type SeguimientoPageProps = {
  params: Promise<{ token: string }>;
};

function formatDate(value: string | null) {
  if (!value) return 'Pendiente';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function stepState(currentIndex: number, index: number) {
  if (index < currentIndex) return 'done';
  if (index === currentIndex) return 'current';
  return 'pending';
}

function orderStepIndex(order: PublicOrderTracking) {
  if (order.status === 'CANCELLED') return 0;
  if (order.status === 'DELIVERED') return 4;
  if (order.status === 'SHIPPED') return 3;
  if (order.status === 'PREPARING') return 2;
  if (order.status === 'CONFIRMED') return 1;
  return 0;
}

function badgeVariant(status: PublicOrderTracking['status']) {
  if (status === 'DELIVERED') return 'success' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  if (status === 'PENDING_CONFIRMATION') return 'warning' as const;
  return 'neutral' as const;
}

export default async function SeguimientoPage({ params }: SeguimientoPageProps) {
  const { token } = await params;
  const order = await fetchPublicApi<PublicOrderTracking>(
    `/store/orders/tracking/${encodeURIComponent(token)}`,
  );

  if (!order) return <InvalidTracking />;

  const steps = [
    { label: 'Registrado', detail: formatDate(order.createdAt) },
    { label: 'Confirmado', detail: formatDate(order.confirmedAt) },
    { label: 'Preparando', detail: order.status === 'PREPARING' ? 'En proceso' : 'Pendiente' },
    { label: 'Despachado', detail: formatDate(order.shipping?.dispatchedAt ?? null) },
    { label: 'Entregado', detail: formatDate(order.shipping?.deliveredAt ?? null) },
  ];
  const currentStep = orderStepIndex(order);

  return (
    <Container className="py-11.25">
      <div className="mb-9 max-w-185">
        <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#9b7099]">
          Enlace privado
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[48px] leading-[1.15] max-[600px]:text-[38px]">
              Pedido {order.code}
            </h1>
            <p className="mt-3 max-w-150 text-xs leading-[1.9] text-[#786b74]">
              Consulta el avance de tu pedido. La tienda actualiza estos estados segun la
              confirmacion, el pago y el envio.
            </p>
          </div>
          <Badge variant={badgeVariant(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
        </div>
      </div>

      {order.status === 'CANCELLED' && (
        <div className="mb-5 border border-[#ead0d4] bg-[#fff7f7] p-4.5 text-[11px] leading-[1.8] text-[#8f313f]">
          Este pedido aparece como cancelado. Si tienes dudas o ya habias pagado, ponte en contacto
          con la tienda por WhatsApp.
        </div>
      )}

      <section className="mb-5 border border-[#eee8ed] bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-[#493a45]">Avance del pedido</h2>
        <div className="grid gap-3 min-[760px]:grid-cols-5">
          {steps.map((step, index) => {
            const state = stepState(currentStep, index);
            return (
              <div
                key={step.label}
                className={cn(
                  'min-h-24 border p-3.5',
                  state === 'done' && 'border-[#c7ddce] bg-[#f5fbf6]',
                  state === 'current' && 'border-[#d8bfda] bg-[#fbf5fb]',
                  state === 'pending' && 'border-[#eee8ed] bg-[#fbfafb]',
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-[#493a45]">{step.label}</span>
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      state === 'done' && 'bg-success',
                      state === 'current' && 'bg-[#a46ea4]',
                      state === 'pending' && 'bg-[#d8d4cb]',
                    )}
                  />
                </div>
                <p className="text-[10px] leading-[1.7] text-[#83747c]">{step.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <StatusPanel icon={<PackageCheck size={18} />} title="Pedido">
          <Summary label="Estado" value={ORDER_STATUS_LABELS[order.status]} />
          <Summary label="Total" value={formatCOP(order.total)} />
          <Summary
            label="Envio"
            value={order.shippingCost === null ? 'Por confirmar' : formatCOP(order.shippingCost)}
          />
        </StatusPanel>

        <StatusPanel icon={<CreditCard size={18} />} title="Pago">
          <Summary label="Metodo" value={order.paymentMethodName} />
          <Summary label="Estado" value={PAYMENT_STATUS_LABELS[order.paymentStatus]} />
        </StatusPanel>

        <StatusPanel icon={<Truck size={18} />} title="Envio">
          <Summary
            label="Estado"
            value={order.shipping ? SHIPPING_STATUS_LABELS[order.shipping.status] : 'Sin despachar'}
          />
          <Summary label="Transportadora" value={order.shipping?.carrierName ?? 'Pendiente'} />
          <Summary label="Guia" value={order.shipping?.trackingNumber ?? 'Pendiente'} />
          {order.shipping?.trackingUrl && (
            <Button asChild variant="outline" className="mt-3 w-full">
              <a href={order.shipping.trackingUrl} target="_blank" rel="noreferrer">
                Abrir rastreo <ArrowRight size={15} />
              </a>
            </Button>
          )}
        </StatusPanel>
      </div>

      <div className="mt-7 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/productos">Seguir comprando</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </Container>
  );
}

function InvalidTracking() {
  return (
    <Container className="py-11.25">
      <div className="mx-auto max-w-150 bg-[#faf6f8] px-6 py-15 text-center">
        <Clock3 size={44} className="mx-auto mb-4 text-[#9b7199]" />
        <p className="text-[10px] font-bold uppercase tracking-[.22em] text-[#9b7099]">
          Enlace privado
        </p>
        <h1 className="font-serif mb-4 mt-2 text-[42px] leading-tight">
          No pudimos abrir este seguimiento
        </h1>
        <p className="mx-auto mb-6 max-w-110 text-xs leading-[1.9] text-[#88777e]">
          Revisa que el enlace este completo. Por seguridad no mostramos informacion cuando el
          enlace no es valido.
        </p>
        <Button asChild>
          <Link href="/productos">Volver al catalogo</Link>
        </Button>
      </div>
    </Container>
  );
}

function StatusPanel({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-[#eee8ed] bg-white p-4.5">
      <div className="mb-3 flex items-center gap-2 text-[#7a5178]">
        {icon}
        <h2 className="text-xs font-semibold text-[#493a45]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="my-2 flex justify-between gap-3 text-[11px]">
      <span className="text-[#756a72]">{label}</span>
      <strong className="text-right font-semibold text-[#493a45]">{value}</strong>
    </div>
  );
}
