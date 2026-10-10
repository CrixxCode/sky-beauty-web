import type { ReactNode } from 'react';
import { AdminShell } from '@/features/admin-auth/admin-shell';
import { requireAdmin } from '@/features/admin-auth/session.server';

// La verificación de la sesión se repite en cada página (requireAdmin/requireRole): el layout
// no se vuelve a renderizar en cada navegación. La protección real está en el backend.
export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
