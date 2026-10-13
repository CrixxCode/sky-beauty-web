import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { StorePageHeading } from '@/features/storefront/catalog-ui';
import { CartPage } from '@/features/cart/cart-page';

export const metadata: Metadata = { title: 'Carrito' };

export default function CarritoPage() {
  return (
    <Container className="py-11.25">
      <StorePageHeading
        eyebrow="Tu selección"
        title="Tu bolsa de belleza"
        description="Revisa productos, cantidades y precios antes de continuar al checkout."
      />
      <CartPage />
    </Container>
  );
}
