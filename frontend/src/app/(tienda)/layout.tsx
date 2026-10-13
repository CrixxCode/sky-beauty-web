import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { Container } from '@/components/layout/container';
import { StoreFooter } from '@/components/layout/store-footer';
import { CartHeaderLink } from '@/features/cart/cart-header-link';
import { CartProvider } from '@/features/cart/cart-context';
import { StoreSearch } from '@/features/storefront/catalog-ui';
import { fetchPublicApi } from '@/lib/api.server';
import type { PublicCategory } from '@/types/catalog';
import type { PublicStoreInfo } from '@/types/store';

/**
 * Metadatos de la tienda para buscadores y para la vista previa al compartir en redes. La
 * descripción sale de la configuración (contenido); sin ella se usa la general del sitio.
 */
export async function generateMetadata(): Promise<Metadata> {
  const info = await fetchPublicApi<PublicStoreInfo>('/store/info');
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
    fetchPublicApi<PublicStoreInfo>('/store/info'),
    fetchPublicApi<PublicCategory[]>('/store/categories'),
  ]);
  const navCategories = (categories ?? [])
    .flatMap((category) => [category, ...category.children])
    .slice(0, 6);

  return (
    <CartProvider>
      {info?.announcementText && (
        // Barra de anuncio (replica .announcement del prototipo); el texto sale del panel.
        <div className="bg-[#9b7199] px-5 py-2 text-center text-[10px] tracking-[.075em] text-white max-[600px]:text-[9px]">
          {info.announcementText}
        </div>
      )}
      <header className="relative z-50 border-b border-[#eee9e6] bg-paper/98">
        <Container className="flex h-22.5 items-center justify-between gap-9.5 max-[850px]:h-20 max-[600px]:h-17.25">
          <Link href="/" aria-label="Inicio de Sky Beauty" className="min-w-0">
            <BrandLogo />
          </Link>
          <div className="flex flex-1 justify-center max-[600px]:hidden">
            <StoreSearch />
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/productos"
              className="text-[11px] font-semibold text-[#794b79] max-[600px]:text-[10px]"
            >
              Catálogo
            </Link>
            <CartHeaderLink />
          </div>
        </Container>
        <div className="bg-mauve-dark max-[600px]:hidden">
          <Container className="flex h-11.5 items-center justify-center gap-6.75 overflow-x-auto">
            <Link
              href="/productos"
              className="shrink-0 text-[10px] text-[#f1e4ef] hover:text-white"
            >
              Ver todo
            </Link>
            {navCategories.map((category) => (
              <Link
                key={category.id}
                href={`/productos?categoria=${category.id}`}
                className="shrink-0 text-[10px] text-[#f1e4ef] hover:text-white"
              >
                {category.name}
              </Link>
            ))}
          </Container>
        </div>
      </header>
      <Container className="mb-3 hidden h-10.75 items-center bg-[#f8f4f5] max-[600px]:flex">
        <StoreSearch compact />
      </Container>
      <main className="flex-1">{children}</main>
      <StoreFooter info={info} />
    </CartProvider>
  );
}
