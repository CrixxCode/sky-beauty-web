'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { CartLine, CartQuote } from '@/types/checkout';

export function useCartQuote(items: CartLine[], municipalityCode?: string) {
  return useQuery({
    queryKey: ['cart-quote', items, municipalityCode ?? ''],
    enabled: items.length > 0,
    queryFn: () =>
      apiFetch<CartQuote>('/store/orders/quote', {
        method: 'POST',
        body: JSON.stringify({ items, municipalityCode }),
      }),
  });
}
