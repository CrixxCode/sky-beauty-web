import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireRole } from '@/features/admin-auth/session.server';
import { StaffAccounts } from '@/features/admin-users/staff-accounts';

export const metadata: Metadata = { title: 'Cuentas' };

// Vista sin equivalente en el prototipo: sigue el lenguaje visual de su panel /admin
// (tabla de productos y formulario de campos).
export default async function CuentasPage() {
  await requireRole('ADMIN');

  return (
    <>
      <AdminHeading
        title="Cuentas"
        description="Crea cuentas para el personal, desactívalas o restablece sus contraseñas."
      />
      <StaffAccounts />
    </>
  );
}
