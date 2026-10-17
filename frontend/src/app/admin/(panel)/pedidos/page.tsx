import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { OrdersManager } from '@/features/orders/orders-manager';

export const metadata: Metadata = { title: 'Pedidos' };

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string | string[] }>;
}) {
  const admin = await requireAdmin();
  const { pedido } = await searchParams;
  const orderId =
    typeof pedido === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pedido)
      ? pedido
      : null;

  return (
    <>
      <AdminHeading
        title="Pedidos"
        description="Confirma pedidos, ajusta productos pendientes, cotiza el envío y actualiza estados."
      />
      <OrdersManager key={orderId ?? 'list'} role={admin.role} initialOrderId={orderId} />
    </>
  );
}
