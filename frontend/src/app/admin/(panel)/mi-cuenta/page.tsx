import type { Metadata } from 'next';
import { ChangePasswordForm } from '@/features/admin-auth/change-password-form';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { ROLE_LABELS } from '@/types/admin';

export const metadata: Metadata = { title: 'Mi cuenta' };

export default async function MiCuentaPage() {
  const admin = await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">
          {admin.name} · {admin.email} · {ROLE_LABELS[admin.role]}
        </p>
      </div>
      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
        <ChangePasswordForm />
      </section>
    </div>
  );
}
