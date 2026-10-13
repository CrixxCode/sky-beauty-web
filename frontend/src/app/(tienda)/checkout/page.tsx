import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { CheckoutPage } from '@/features/cart/checkout-page';
import { StorePageHeading } from '@/features/storefront/catalog-ui';

export const metadata: Metadata = { title: 'Checkout' };

export default function CheckoutRoutePage() {
  return (
    <Container className="py-11.25">
      <StorePageHeading
        eyebrow="Finalizar compra"
        title="Solo un paso mas"
        description="Completa tus datos de entrega y el metodo de pago para registrar el pedido."
      />
      <CheckoutPage />
    </Container>
  );
}
