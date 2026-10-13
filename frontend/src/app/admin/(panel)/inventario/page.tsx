import type { Metadata } from 'next';
import { AdminHeading } from '@/features/admin-auth/admin-ui';
import { requireAdmin } from '@/features/admin-auth/session.server';
import { InventoryManager } from '@/features/inventory/inventory-manager';

export const metadata: Metadata = { title: 'Inventario' };

export default async function InventarioPage() {
  await requireAdmin();

  return (
    <>
      <AdminHeading
        title="Inventario"
        description="Existencias por variante, entradas, ajustes e historial de movimientos."
      />
      <InventoryManager />
    </>
  );
}
