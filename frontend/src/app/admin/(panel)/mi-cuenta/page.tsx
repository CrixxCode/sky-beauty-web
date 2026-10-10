import type { Metadata } from 'next';
import { AdminHeading, AdminPanel, AdminPanelTitle } from '@/features/admin-auth/admin-ui';
import { ChangePasswordForm } from '@/features/admin-auth/change-password-form';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { ROLE_LABELS } from '@/types/admin';

export const metadata: Metadata = { title: 'Mi cuenta' };

// Vista sin equivalente en el prototipo: sigue el lenguaje visual de su panel /admin.
export default async function MiCuentaPage() {
  const admin = await requireAdmin();

  return (
    <>
      <AdminHeading
        title="Mi cuenta"
        description={`${admin.name} · ${admin.email} · ${ROLE_LABELS[admin.role]}`}
      />
      <AdminPanel className="max-w-160">
        <AdminPanelTitle>Cambiar contraseña</AdminPanelTitle>
        <ChangePasswordForm />
      </AdminPanel>
    </>
  );
}
