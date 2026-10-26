import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { ShippingManager } from '@/features/shipping/shipping-manager';

export const metadata: Metadata = { title: 'Envíos' };

export default async function EnviosPage() {
  const admin = await requireAdmin();

  return (
    <>
      <AdminHeading
        title="Envíos"
        description="Administra transportadoras y sus tarifas, y usa el detalle del pedido para registrar la guía, el despacho y la entrega."
      />
      <ShippingManager canEditRates={admin.role === 'ADMIN'} />
    </>
  );
}
