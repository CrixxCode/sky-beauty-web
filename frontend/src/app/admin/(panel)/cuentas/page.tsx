import type { Metadata } from 'next';
import { requireRole } from '@/features/admin-auth/session.server';
import { StaffAccounts } from '@/features/admin-users/staff-accounts';

export const metadata: Metadata = { title: 'Cuentas' };

export default async function CuentasPage() {
  await requireRole('ADMIN');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Cuentas del panel</h1>
        <p className="text-sm text-muted-foreground">
          Crea cuentas para el personal, desactívalas o restablece sus contraseñas.
        </p>
      </div>
      <StaffAccounts />
    </div>
  );
}
