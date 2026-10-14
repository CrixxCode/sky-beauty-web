import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { Container } from '@/components/layout/container';
import { StoreFooter } from '@/components/layout/store-footer';
import { CartHeaderLink } from '@/features/cart/cart-header-link';
import { CartProvider } from '@/features/cart/cart-context';
import { FavoritesHeaderLink } from '@/features/favorites/favorite-button';
import { FavoritesProvider } from '@/features/favorites/favorites-context';
import { StoreSearch } from '@/features/storefront/catalog-ui';
import { StoreCategoryNav, StoreMobileMenu } from '@/features/storefront/store-navigation';
import { fetchPublicApiOptional } from '@/lib/api.server';
import type { PublicCategory } from '@/types/catalog';
import type { PublicStoreInfo } from '@/types/store';

/**
 * Metadatos de la tienda para buscadores y para la vista previa al compartir en redes. La
 * descripción sale de la configuración (contenido); sin ella se usa la general del sitio.
 */
export async function generateMetadata(): Promise<Metadata> {
  const info = await fetchPublicApiOptional<PublicStoreInfo>('/store/info');
  const storeName = info?.storeName ?? 'Sky Beauty Maquillaje';
  const description = info?.tagline ?? undefined;
  return {
    ...(description && { description }),
    openGraph: {
      type: 'website',
      locale: 'es_CO',
      siteName: storeName,
      title: storeName,
      ...(description && { description }),
    },
  };
}

export default async function TiendaLayout({ children }: { children: ReactNode }) {
  const [info, categories] = await Promise.all([
    fetchPublicApiOptional<PublicStoreInfo>('/store/info'),
    fetchPublicApiOptional<PublicCategory[]>('/store/categories'),
  ]);
  // Categorías principales; sus subcategorías se abren en un submenú (escritorio) o debajo de
  // cada una (menú del celular).
  const navCategories = categories ?? [];

  return (
    <CartProvider>
      <FavoritesProvider>
        {/* Marca el área de la tienda para la variante `store:` (escala mínima de 12px). */}
        <div data-area="store" className="contents">
          <a
            href="#contenido"
            className="sr-only z-200 bg-mauve-dark px-4 py-3 text-xs font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Saltar al contenido
          </a>
          {info?.announcementText && (
            // Barra de anuncio (replica .announcement del prototipo); el texto sale del panel.
            <div className="bg-[#7f5d7d] px-5 py-2 text-center text-xs tracking-[.075em] text-white">
              {info.announcementText}
            </div>
          )}
          <header className="relative z-50 border-b border-[#eee9e6] bg-paper/98">
            <Container className="flex h-22.5 items-center justify-between gap-9.5 max-[850px]:h-20 max-[600px]:h-17.25 max-[600px]:gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <StoreMobileMenu
                  categories={navCategories}
                  whatsappNumber={info?.whatsappNumber ?? null}
                />
                <Link href="/" aria-label="Inicio de Sky Beauty" className="min-w-0">
                  <BrandLogo />
                </Link>
              </div>
              <div className="flex flex-1 justify-center max-[600px]:hidden">
                <StoreSearch />
              </div>
              <div className="flex items-center gap-1.5 min-[601px]:gap-3">
                <Link
                  href="/productos"
                  className="text-xs font-semibold text-[#794b79] hover:text-[#5b365b] max-[600px]:hidden"
                >
                  Catálogo
                </Link>
                <FavoritesHeaderLink />
                <CartHeaderLink />
              </div>
            </Container>
            <StoreCategoryNav categories={navCategories} />
          </header>
          <Container className="mb-3 hidden h-10.75 items-center bg-[#f8f4f5] max-[600px]:flex">
            <StoreSearch compact />
          </Container>
          <main id="contenido" tabIndex={-1} className="flex-1 scroll-mt-4 outline-none">
            {children}
          </main>
          <StoreFooter info={info} />
        </div>
      </FavoritesProvider>
    </CartProvider>
  );
}
