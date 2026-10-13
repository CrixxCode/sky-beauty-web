import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { CheckoutPage } from '@/features/cart/checkout-page';
import { StorePageHeading } from '@/features/storefront/catalog-ui';
import { fetchPublicApi } from '@/lib/api.server';
import type { PublicStoreInfo } from '@/types/store';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutRoutePage() {
  const info = await fetchPublicApi<PublicStoreInfo>('/store/info');
  return (
    <Container className="py-11.25">
      <StorePageHeading
        eyebrow="Finalizar compra"
        title="Solo un paso más"
        description="Completa tus datos de entrega y el método de pago para registrar el pedido."
      />
      <CheckoutPage publishedPages={info?.publishedPages ?? []} />
    </Container>
  );
}
