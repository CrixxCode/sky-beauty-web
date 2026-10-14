import type { Metadata } from 'next';
import TiendaLayout from './(tienda)/layout';
import TiendaNotFound from './(tienda)/not-found';

export const metadata: Metadata = { title: 'Página no encontrada', robots: { index: false } };

/** Direcciones que no existen: la misma página de la tienda, con su encabezado y pie. */
export default function NotFound() {
  return (
    <TiendaLayout>
      <TiendaNotFound />
    </TiendaLayout>
  );
}
