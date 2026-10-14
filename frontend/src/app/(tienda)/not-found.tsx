import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { StoreMessage } from '@/features/storefront/store-message';

export const metadata: Metadata = { title: 'Página no encontrada', robots: { index: false } };

/** Producto, página o enlace que no existe (notFound() en las páginas de la tienda). */
export default function TiendaNotFound() {
  return (
    <StoreMessage
      title="No encontramos esta página"
      description="Es posible que el enlace esté mal escrito o que el producto ya no esté disponible."
    >
      <Button asChild>
        <Link href="/productos">Ver productos</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/">Ir al inicio</Link>
      </Button>
    </StoreMessage>
  );
}
