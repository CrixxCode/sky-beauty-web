import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireRole } from '@/features/admin-auth/session.server';
import { PromotionsManager } from '@/features/promotions/promotions-manager';

export const metadata: Metadata = { title: 'Promociones' };

export default async function PromocionesPage() {
  await requireRole('ADMIN');

  return (
    <>
      <AdminHeading
        title="Promociones"
        description="Configura descuentos por variante, producto o categoría con historial de cambios."
      />
      <PromotionsManager />
    </>
  );
}
