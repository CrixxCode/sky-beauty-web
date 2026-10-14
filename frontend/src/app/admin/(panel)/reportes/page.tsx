import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireRole } from '@/features/admin-auth/session.server';
import { ReportsManager } from '@/features/reports/reports-manager';

export const metadata: Metadata = { title: 'Reportes' };

// Solo la propietaria: los reportes incluyen costos y márgenes (Context/decisiones.md).
export default async function ReportesPage() {
  await requireRole('ADMIN');

  return (
    <>
      <AdminHeading
        title="Reportes"
        description="Ventas por período, productos más vendidos y ganancia de la tienda."
      />
      <ReportsManager />
    </>
  );
}
