import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { OrdersManager } from '@/features/orders/orders-manager';

export const metadata: Metadata = { title: 'Pedidos' };

export default async function PedidosPage() {
  const admin = await requireAdmin();

  return (
    <>
      <AdminHeading
        title="Pedidos"
        description="Confirma pedidos, ajusta productos pendientes, cotiza envio y actualiza estados."
      />
      <OrdersManager role={admin.role} />
    </>
  );
}
