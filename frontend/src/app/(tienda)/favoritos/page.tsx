import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { FavoritesPage } from '@/features/favorites/favorites-page';
import { StorePageHeading } from '@/features/storefront/catalog-ui';
import { fetchPublicApi } from '@/lib/api.server';
import type { PublicBrand, PublicCategory } from '@/types/catalog';

// Los favoritos son de cada navegador: la página no se indexa.
export const metadata: Metadata = {
  title: 'Favoritos',
  robots: { index: false, follow: false },
};

export default async function FavoritosPage() {
  const [categories, brands] = await Promise.all([
    fetchPublicApi<PublicCategory[]>('/store/categories'),
    fetchPublicApi<PublicBrand[]>('/store/brands'),
  ]);

  return (
    <Container className="min-h-[70vh] py-16.25 max-[600px]:py-11.25">
      <StorePageHeading
        eyebrow="Tus favoritos"
        title="Productos guardados"
        description="Se guardan en este navegador, sin crear una cuenta. Si borras los datos del navegador o usas otro dispositivo, no aparecerán."
      />
      <FavoritesPage brands={brands ?? []} categories={categories ?? []} />
    </Container>
  );
}
