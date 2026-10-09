'use client';

import { useQuery } from '@tanstack/react-query';
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

  const label = isPending
    ? 'Comprobando conexión…'
    : isError
      ? 'Sin conexión con el servidor'
      : data.database === 'ok'
        ? 'Servidor y base de datos conectados'
        : 'Estado desconocido';

  return (
    <p
      role="status"
      className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted-foreground"
    >
      {label}
    </p>
  );
}
