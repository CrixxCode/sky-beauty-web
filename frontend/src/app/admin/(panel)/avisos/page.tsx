import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { NoticesManager } from '@/features/notices/notices-manager';

export const metadata: Metadata = { title: 'Avisos' };

export default async function AvisosPage() {
  await requireAdmin();

  return (
    <>
      <AdminHeading
        title="Avisos"
        description="Avisos de cancelación para enviar al cliente por WhatsApp. Ábrelo, envíalo y márcalo como enviado."
      />
      <NoticesManager />
    </>
  );
}
