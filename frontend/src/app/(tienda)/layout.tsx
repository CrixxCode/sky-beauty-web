import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { Container } from '@/components/layout/container';
import { StoreFooter } from '@/components/layout/store-footer';
import { fetchPublicApi } from '@/lib/api.server';
import type { PublicStoreInfo } from '@/types/store';

// Estructura de la tienda (replica .site-header y .site-footer del prototipo). La búsqueda, el
// carrito, la navegación por categorías y la barra de anuncios se agregan en sus módulos
// (ver Context/plan-desarrollo.md); no se copian los textos de demostración del prototipo.
export default async function TiendaLayout({ children }: { children: ReactNode }) {
  const info = await fetchPublicApi<PublicStoreInfo>('/store/info');

  return (
    <>
      <header className="relative z-50 border-b border-[#eee9e6] bg-paper/98">
        <Container className="flex h-22.5 items-center justify-between gap-9.5 max-[850px]:h-20 max-[600px]:h-17.25">
          <Link href="/" aria-label="Inicio de Sky Beauty">
            <BrandLogo />
          </Link>
        </Container>
      </header>
      <main className="flex-1">{children}</main>
      <StoreFooter info={info} />
    </>
  );
}
