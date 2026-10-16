'use client';

import { Button } from '@/components/ui/button';
import './globals.css';

/** Último recurso: falla el diseño general del sitio. Reemplaza al layout raíz. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="es">
      <body className="flex min-h-screen items-center justify-center bg-paper p-6 font-sans">
        <div className="max-w-140 bg-[#faf6f8] px-6 py-15 text-center">
          <h1 className="mb-3 font-serif text-[38px] leading-[1.2]">Algo salió mal</h1>
          <p className="mb-6 text-xs leading-[1.8] text-[#88777e]">
            Tuvimos un problema al cargar esta página. Intenta de nuevo en unos segundos.
          </p>
          <Button onClick={reset}>Intentar de nuevo</Button>
        </div>
      </body>
    </html>
  );
}
