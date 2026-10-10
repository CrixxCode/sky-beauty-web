import { Container } from '@/components/layout/container';
import { Eyebrow, serifClass } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

// Página de inicio provisional con el estilo de .page-heading del prototipo. El inicio real
// (hero, categorías, productos) se construye en el módulo 3 replicando el prototipo.
export default function InicioPage() {
  return (
    <Container className="min-h-[70vh] pb-27 pt-16.25 max-[600px]:pb-18.75 max-[600px]:pt-11.25">
      <div className="max-w-200">
        <Eyebrow>Sky Beauty Maquillaje</Eyebrow>
        <h1
          className={cn(
            serifClass,
            'mb-4 mt-2.5 text-[clamp(39px,5vw,64px)] leading-[1.2] max-[600px]:text-[40px]',
          )}
        >
          Tienda en construcción
        </h1>
      </div>
    </Container>
  );
}
