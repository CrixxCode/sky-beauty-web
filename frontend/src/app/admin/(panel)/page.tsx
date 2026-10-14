import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { navItemsFor } from '@/features/admin-auth/admin-nav-items';
import { AdminHeading, AdminPanel, AdminPanelTitle } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { DashboardPendingStats, DashboardSales } from '@/features/dashboard/dashboard-overview';
import { ApiStatus } from '@/features/system/api-status';

// Replica la sección "Resumen" del panel del prototipo: cifras arriba; actividad y accesos rápidos
// debajo. Los pendientes los ve todo el panel; las ventas, solo la propietaria.
export default async function AdminResumenPage() {
  const admin = await requireAdmin();
  const quickLinks = navItemsFor(admin.role).filter((item) => item.href !== '/admin');

  return (
    <>
      <AdminHeading title="Resumen" description={`Hola, ${admin.name}.`} />
      <DashboardPendingStats />
      <div className="mt-5 grid gap-5 max-[600px]:mt-2.5 max-[600px]:gap-2.5 min-[601px]:grid-cols-[1.7fr_1fr]">
        <div className="grid content-start gap-5 max-[600px]:gap-2.5">
          {admin.role === 'ADMIN' && <DashboardSales />}
          <AdminPanel>
            <AdminPanelTitle>Estado del sistema</AdminPanelTitle>
            <ApiStatus />
          </AdminPanel>
        </div>
        <AdminPanel>
          <AdminPanelTitle>Accesos rápidos</AdminPanelTitle>
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex w-full items-center justify-between border-b border-[#eee9ec] py-3.75 text-[11px] text-[#665e66]"
            >
              {item.label}
              <ChevronRight size={17} />
            </Link>
          ))}
        </AdminPanel>
      </div>
    </>
  );
}
