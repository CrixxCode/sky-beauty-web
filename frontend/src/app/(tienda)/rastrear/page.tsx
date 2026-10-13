import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { StorePageHeading } from '@/features/storefront/catalog-ui';
import { TrackOrderForm } from '@/features/tracking/track-order-form';

export const metadata: Metadata = { title: 'Rastrear pedido' };

export default function RastrearPage() {
  return (
    <Container className="min-h-[60vh] py-11.25">
      <StorePageHeading
        eyebrow="Tu pedido"
        title="Rastrear pedido"
        description="Escribe el código de tu pedido y el teléfono con el que compraste para ver su estado."
      />
      <TrackOrderForm />
    </Container>
  );
}
