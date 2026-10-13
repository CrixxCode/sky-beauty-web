'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { CartLine } from '@/types/checkout';

const STORAGE_KEY = 'sky-beauty-cart';

interface CartContextValue {
  items: CartLine[];
  count: number;
  addItem: (variantId: string, quantity?: number) => void;
  updateItem: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]') as CartLine[];
    return parsed.filter((item) => item.variantId && item.quantity > 0);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setItems(readCart()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      addItem: (variantId, quantity = 1) => {
        setItems((current) => {
          const existing = current.find((item) => item.variantId === variantId);
          if (existing) {
            return current.map((item) =>
              item.variantId === variantId
                ? { ...item, quantity: Math.max(1, item.quantity + quantity) }
                : item,
            );
          }
          return [...current, { variantId, quantity: Math.max(1, quantity) }];
        });
        toast.success('Producto agregado a tu bolsa.');
      },
      updateItem: (variantId, quantity) => {
        setItems((current) =>
          current
            .map((item) => (item.variantId === variantId ? { ...item, quantity } : item))
            .filter((item) => item.quantity > 0),
        );
      },
      removeItem: (variantId) => {
        setItems((current) => current.filter((item) => item.variantId !== variantId));
      },
      clear: () => setItems([]),
    }),
    [items],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe usarse dentro de CartProvider.');
  return context;
}
