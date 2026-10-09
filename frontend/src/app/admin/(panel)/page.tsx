import { requireAdmin } from '@/features/admin-auth/session.server';
import { ApiStatus } from '@/features/system/api-status';

export default async function AdminInicioPage() {
  const admin = await requireAdmin();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Hola, {admin.name}</h1>
      <ApiStatus />
    </div>
  );
}
