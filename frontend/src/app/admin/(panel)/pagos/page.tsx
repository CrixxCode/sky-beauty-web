import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { OrdersManager } from '@/features/orders/orders-manager';

export const metadata: Metadata = { title: 'Pagos' };

export default async function PagosPage() {
  const admin = await requireAdmin();

  return (
    <>
      <AdminHeading
        title="Pagos"
        description="Registra comprobantes recibidos por WhatsApp y verifica o rechaza pagos pendientes."
      />
      <OrdersManager
        role={admin.role}
        initialPaymentStatus="AWAITING_VERIFICATION"
        title="Pagos por verificar"
      />
    </>
  );
}
