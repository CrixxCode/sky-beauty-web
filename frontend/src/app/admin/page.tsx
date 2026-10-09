import { ApiStatus } from '@/features/system/api-status';

export default function AdminInicioPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Inicio</h1>
      <ApiStatus />
    </div>
  );
}
