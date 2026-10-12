import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { ProductsManager } from '@/features/catalog/products-manager';

export const metadata: Metadata = { title: 'Productos' };

export default async function ProductosPage() {
  const admin = await requireAdmin();

  return (
    <>
      <AdminHeading
        title="Productos"
        description="Gestión del catálogo, precios base, variantes e inventario inicial."
      />
      <ProductsManager role={admin.role} />
    </>
  );
}

