'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const stepButton =
  'h-full min-h-0 w-11 rounded-none p-0 text-[#6d5868] enabled:hover:translate-y-0 enabled:hover:bg-[#faf1fa] enabled:hover:text-[#5d405b]';

/** Selector de cantidad (replica .quantity del prototipo). Nunca baja de 1 ni pasa de `max`. */
export function QuantityStepper({
  value,
  max,
  onChange,
  disabled = false,
  label,
  className,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Nombre del producto, para las etiquetas accesibles. */
  label?: string;
  className?: string;
}) {
  const suffix = label ? ` de ${label}` : '';
  return (
    <div
      className={cn(
        'flex h-11.25 w-36 items-center justify-between border border-[#e2d8df]',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={disabled || value <= 1}
        className={stepButton}
        aria-label={`Disminuir cantidad${suffix}`}
      >
        <Minus size={15} />
      </Button>
      <span className="text-xs font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className={stepButton}
        aria-label={`Aumentar cantidad${suffix}`}
      >
        <Plus size={15} />
      </Button>
    </div>
  );
}
