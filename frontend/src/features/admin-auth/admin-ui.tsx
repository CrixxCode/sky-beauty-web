import type { ComponentProps, ReactNode } from 'react';
import { Eyebrow, serifClass } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

/** Encabezado de una sección del panel (replica .admin-heading del prototipo). */
export function AdminHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-8.25">
      <Eyebrow>Operación interna</Eyebrow>
      <h1 className={cn(serifClass, 'mb-2.5 mt-1 text-[43px] leading-normal max-[600px]:text-4xl')}>
        {title}
      </h1>
      {description && <p className="text-[11px] text-[#8b7f87]">{description}</p>}
    </div>
  );
}

/** Tarjeta de contenido del panel (replica .admin-panel del prototipo). */
export function AdminPanel({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'min-w-0 border border-admin-line bg-white p-6.5 max-[600px]:p-4.75',
        className,
      )}
      {...props}
    />
  );
}

export function AdminPanelTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2 className={cn('mb-5.75 text-sm font-semibold text-[#493a45]', className)} {...props} />
  );
}

/** Etiqueta de estado (replica .admin-status del prototipo). */
export function AdminStatus({
  tone = 'ok',
  children,
}: {
  tone?: 'ok' | 'out' | 'neutral' | 'warning';
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'whitespace-nowrap rounded-[30px] px-2.25 py-1.25 text-[9px] font-medium',
        tone === 'ok' && 'bg-success-bg text-success',
        tone === 'out' && 'bg-out-bg text-out',
        tone === 'neutral' && 'bg-[#f0e0f0] text-[#7d507a]',
        tone === 'warning' && 'bg-amber-100 text-amber-800',
      )}
    >
      {children}
    </span>
  );
}
