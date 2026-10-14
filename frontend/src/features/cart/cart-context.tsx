'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { CartLine } from '@/types/checkout';

const STORAGE_KEY = 'sky-beauty-cart';

interface CartContextValue {
  items: CartLine[];
  count: number;
  /** false mientras no se ha leído el carrito guardado en el navegador. */
  ready: boolean;
  /** Agrega unidades sin pasar de `max` (existencias y límite por pedido) en total. */
  addItem: (variantId: string, quantity: number, max: number) => void;
  updateItem: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  /** Devuelve a la bolsa una línea quitada (deshacer), en su posición original. */
  restoreItem: (line: CartLine, index: number) => void;
  clear: () => void;
  /**
   * Borrador del formulario del checkout. Vive solo en memoria mientras la pestaña esté abierta,
   * para no perder los datos al ir a la bolsa y volver; no se guarda en el navegador.
   */
  getCheckoutDraft: () => unknown;
  saveCheckoutDraft: (draft: unknown) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartLine[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartLine =>
        typeof item?.variantId === 'string' &&
        Number.isInteger(item?.quantity) &&
        item.quantity > 0,
    );
  } catch {
    return [];
  }
}

function writeCart(items: CartLine[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Sin almacenamiento (modo privado o bloqueado): el carrito vive solo en esta pestaña.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const checkoutDraft = useRef<unknown>(null);
  const router = useRouter();

  // Primero se lee lo guardado; solo después se guarda, para no borrar el carrito al recargar.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setItems(readCart());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (ready) writeCart(items);
  }, [items, ready]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      ready,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      addItem: (variantId, quantity, max) => {
        const current = items.find((item) => item.variantId === variantId)?.quantity ?? 0;
        const next = Math.min(max, current + Math.max(1, quantity));
        if (next <= current) {
          toast.error('Ya tienes en tu bolsa el máximo disponible de este producto.');
          return;
        }
        setItems((list) =>
          list.some((item) => item.variantId === variantId)
            ? list.map((item) =>
                item.variantId === variantId ? { ...item, quantity: next } : item,
              )
            : [...list, { variantId, quantity: next }],
        );
        toast.success(
          next < current + quantity
            ? 'Agregamos a tu bolsa las unidades disponibles.'
            : 'Producto agregado a tu bolsa.',
          { action: { label: 'Ver bolsa', onClick: () => router.push('/carrito') } },
        );
      },
      updateItem: (variantId, quantity) => {
        if (!Number.isInteger(quantity) || quantity < 1) return;
        setItems((list) =>
          list.map((item) => (item.variantId === variantId ? { ...item, quantity } : item)),
        );
      },
      removeItem: (variantId) => {
        setItems((list) => list.filter((item) => item.variantId !== variantId));
      },
      restoreItem: (line, index) => {
        setItems((list) =>
          list.some((item) => item.variantId === line.variantId)
            ? list
            : [...list.slice(0, index), line, ...list.slice(index)],
        );
      },
      clear: () => setItems([]),
      getCheckoutDraft: () => checkoutDraft.current,
      saveCheckoutDraft: (draft) => {
        checkoutDraft.current = draft;
      },
    }),
    [items, ready, router],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de CartProvider.');
  return context;
}
