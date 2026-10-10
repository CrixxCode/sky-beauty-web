import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { Container } from '@/components/layout/container';
import { serifClass } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

// Estructura de la tienda (replica .site-header y .site-footer del prototipo). La búsqueda, el
// carrito, la navegación por categorías, la barra de anuncios y los textos del pie se agregan en sus
// módulos (ver Context/plan-desarrollo.md); no se copian los textos de demostración del prototipo.
export default function TiendaLayout({ children }: { children: ReactNode }) {
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
      <footer className="bg-[#594052] pt-16.75 text-[#f7edf2] max-[600px]:pt-12">
        <Container>
          <h2 className={cn(serifClass, 'text-[39px] text-white')}>Sky Beauty</h2>
        </Container>
        <Container className="mt-15.5 flex justify-between gap-4 border-t border-[#826b7f] py-5.25 text-[10px] text-[#e6d6e1] max-[600px]:mt-8.75 max-[600px]:flex-col max-[600px]:text-[9px]">
          <span>© {new Date().getFullYear()} Sky Beauty Maquillaje</span>
          <span>Colombia</span>
        </Container>
      </footer>
    </>
  );
}
