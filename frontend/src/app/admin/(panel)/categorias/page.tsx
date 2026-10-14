import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { CategoriesManager } from '@/features/catalog/categories-manager';

export const metadata: Metadata = { title: 'Categorías' };

export default async function CategoriasPage() {
  const admin = await requireAdmin();

  return (
    <>
      <AdminHeading
        title="Categorías"
        description="Organización del catálogo en categorías y subcategorías (máximo 2 niveles)."
      />
      <CategoriesManager canDelete={admin.role === 'ADMIN'} />
    </>
  );
}
