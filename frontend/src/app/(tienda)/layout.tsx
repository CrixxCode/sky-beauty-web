import Link from 'next/link';
import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';

// Estructura de la tienda pública. El logo, la navegación por categorías, el carrito y los datos
// de contacto se agregan en sus módulos (ver Context/plan-desarrollo.md).
export default function TiendaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-border bg-surface">
        <Container className="flex h-16 items-center">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Sky Beauty
          </Link>
        </Container>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border bg-surface py-6 text-sm text-muted-foreground">
        <Container>Sky Beauty Maquillaje</Container>
      </footer>
    </>
  );
}
