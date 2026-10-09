import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';
import { AdminNav } from '@/features/admin-auth/admin-nav';
import { LogoutButton } from '@/features/admin-auth/logout-button';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { ROLE_LABELS } from '@/types/admin';

// La verificación de la sesión se repite en cada página (requireAdmin/requireRole): el layout
// no se vuelve a renderizar en cada navegación. La protección real está en el backend.
export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <>
      <header className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold">Sky Beauty · Panel</span>
            <span className="text-sm text-muted-foreground sm:hidden">
              {admin.name} · {ROLE_LABELS[admin.role]}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <AdminNav role={admin.role} />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {admin.name} · {ROLE_LABELS[admin.role]}
            </span>
            <LogoutButton />
          </div>
        </Container>
      </header>
      <main className="flex-1 py-8">
        <Container>{children}</Container>
      </main>
    </>
  );
}
