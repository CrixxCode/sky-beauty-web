'use client';

import { useRouter } from 'next/navigation';
import { startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { StoreMessage } from '@/features/storefront/store-message';

/** La API no respondió o falló al armar la página: se ofrece reintentar, sin decir "no existe". */
export default function TiendaError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <StoreMessage
      title="No pudimos cargar esta página"
      description="Tuvimos un problema al conectar con la tienda. Intenta de nuevo en unos segundos."
    >
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
    </StoreMessage>
  );
}
