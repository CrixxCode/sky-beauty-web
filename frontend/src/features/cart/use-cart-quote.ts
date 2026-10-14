'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { CartLine, CartQuote } from '@/types/checkout';

/**
 * Cotización de la bolsa. Mientras se recalcula (al cambiar una cantidad o el municipio) se sigue
 * mostrando la anterior, marcada con `isPlaceholderData`, para que la lista no desaparezca.
 */
export function useCartQuote(items: CartLine[], municipalityCode?: string) {
  return useQuery({
    queryKey: ['cart-quote', items, municipalityCode ?? ''],
    enabled: items.length > 0,
    placeholderData: keepPreviousData,
    queryFn: () =>
      apiFetch<CartQuote>('/store/orders/quote', {
        method: 'POST',
        // Sin municipio se omite: la API rechaza un código vacío.
        body: JSON.stringify({ items, municipalityCode: municipalityCode || undefined }),
      }),
  });
}
