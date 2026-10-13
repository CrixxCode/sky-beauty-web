import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { OrderCreatedPage } from '@/features/cart/order-created-page';

export const metadata: Metadata = { title: 'Pedido creado' };

export default async function PedidoCreadoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <Container className="py-11.25">
      <OrderCreatedPage code={code} />
    </Container>
  );
}
