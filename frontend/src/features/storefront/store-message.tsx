import type { ReactNode } from 'react';
import { Container } from '@/components/layout/container';

/**
 * Aviso a página completa de la tienda (página no encontrada, error al cargar). El prototipo no
 * tiene estas vistas: replica el lenguaje del aviso de bolsa vacía (.empty-state).
 */
export function StoreMessage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Container className="py-11.25">
      <div className="mx-auto max-w-140 bg-[#faf6f8] px-6 py-15 text-center">
        <h1 className="font-serif mb-3 text-[38px] leading-[1.2] max-[600px]:text-[32px]">
          {title}
        </h1>
        <p className="mb-6 text-xs leading-[1.8] text-[#72646a]">{description}</p>
        {children && <div className="flex flex-wrap justify-center gap-3">{children}</div>}
      </div>
    </Container>
  );
}
