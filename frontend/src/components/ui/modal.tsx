'use client';

import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'lg',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    // Prevenir scroll en el fondo mientras el modal está abierto
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fondo oscuro semitransparente */}
      <div
        className="fixed inset-0 bg-[#251a23]/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Tarjeta del modal */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full rounded border border-[#eee8ed] bg-white p-6 shadow-2xl max-[600px]:p-4.5',
          maxWidthMap[maxWidth],
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-[#f0ecf0] pb-3">
          <div>
            <h2 className="text-base font-semibold text-[#493a45]">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[11px] text-[#8b7f87]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[#8b7f87] transition-colors hover:bg-[#f6eff5] hover:text-[#493a45]"
            aria-label="Cerrar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
