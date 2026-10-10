'use client';

import { useQuery } from '@tanstack/react-query';
import { AdminStatus } from '@/features/admin-auth/admin-ui';
import { apiFetch } from '@/lib/api';

interface HealthResponse {
  status: 'ok';
  database: 'ok';
}

/** Muestra si el backend y la base de datos responden, a través del proxy /api/v1. */
export function ApiStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthResponse>('/health'),
  });

  const connected = !isPending && !isError && data.database === 'ok';
  const label = isPending
    ? 'Comprobando conexión…'
    : isError
      ? 'Sin conexión con el servidor'
      : connected
        ? 'Servidor y base de datos conectados'
        : 'Estado desconocido';

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#eee9ec] py-3.75">
      <p role="status" className="text-[11px] text-[#665e66]">
        {label}
      </p>
      {!isPending && (
        <AdminStatus tone={connected ? 'ok' : 'out'}>
          {connected ? 'En línea' : 'Sin conexión'}
        </AdminStatus>
      )}
    </div>
  );
}
