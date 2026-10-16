import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { OrderCreatedPage } from '@/features/cart/order-created-page';
import { fetchPublicApiOptional } from '@/lib/api.server';
import type { PublicStoreInfo } from '@/types/store';

// La página del pedido es personal: no se indexa.
export const metadata: Metadata = {
  title: 'Pedido creado',
  robots: { index: false, follow: false },
};

export default async function PedidoCreadoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // Contacto de la tienda para cuando no hay número de WhatsApp configurado.
  const info = await fetchPublicApiOptional<PublicStoreInfo>('/store/info');
  return (
    <Container className="py-11.25">
      <OrderCreatedPage
        code={code}
        contact={{ email: info?.contactEmail ?? null, phone: info?.contactPhone ?? null }}
      />
    </Container>
  );
}
