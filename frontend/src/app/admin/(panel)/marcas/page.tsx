import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { BrandsManager } from '@/features/catalog/brands-manager';

export const metadata: Metadata = { title: 'Marcas' };

export default async function MarcasPage() {
  await requireAdmin();

  return (
    <>
      <AdminHeading
        title="Marcas"
        description="Gestión de marcas comerciales de los productos de Sky Beauty."
      />
      <BrandsManager />
    </>
  );
}

