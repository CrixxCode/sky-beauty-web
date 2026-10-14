import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Etiqueta, control y mensaje de error de un campo (replica .field del prototipo). */
export function FormField({
  id,
  label,
  description,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  description?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('mb-3.5 flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[11px] font-medium text-field-label store:text-xs">
        {label}
      </label>
      {description && (
        <span className="-mt-0.5 text-[10px] leading-tight text-muted store:text-xs">
          {description}
        </span>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="text-[11px] text-danger store:text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

/** Atributos de accesibilidad para un control con posible error. */
export function fieldA11y(id: string, error?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  } as const;
}

/** Mensaje de error general de un formulario (replica .form-error del prototipo). */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="my-3 border border-danger-border bg-danger-bg px-3.25 py-2.75 text-[11px] text-danger store:text-xs"
    >
      {children}
    </p>
  );
}
