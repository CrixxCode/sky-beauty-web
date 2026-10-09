import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';

export const metadata: Metadata = {
  title: { default: 'Panel', template: '%s | Panel Sky Beauty' },
  robots: { index: false, follow: false },
};

// Estructura del panel administrativo. El acceso con sesión y el menú por rol se agregan en el módulo 1.
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
  return (
    <div className="flex flex-1 flex-col bg-muted">
      <header className="border-b border-border bg-surface">
        <Container className="flex h-14 items-center text-sm font-semibold">
          Panel administrativo
        </Container>
      </header>
      <main className="flex-1 py-8">
        <Container>{children}</Container>
      </main>
    </div>
  );
}
