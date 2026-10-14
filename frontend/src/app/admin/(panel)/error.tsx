'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { AdminHeading, AdminPanel } from '@/features/admin-auth/admin-ui';

/** Error al armar una página del panel (por ejemplo, la API no respondió). */
export default function AdminPanelError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <>
      <AdminHeading
        title="No se pudo cargar"
        description="Hubo un problema al conectar con el sistema."
      />
      <AdminPanel>
        <p className="mb-5 text-[11px] text-[#665e66]">
          Intenta de nuevo en unos segundos. Si el problema continúa, revisa el estado del sistema
          en el resumen.
        </p>
        <Button
          onClick={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          Intentar de nuevo
        </Button>
      </AdminPanel>
    </>
  );
}
