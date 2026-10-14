'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useCart } from './cart-context';

export function CartHeaderLink() {
  const { count } = useCart();
  return (
    <Link
      href="/carrito"
      className="relative grid h-11 w-11 place-items-center text-[#3a2c36] hover:text-[#70436f]"
      aria-label={`Bolsa de compra, ${count} ${count === 1 ? 'producto' : 'productos'}`}
    >
      <ShoppingBag size={20} strokeWidth={1.7} />
      {count > 0 && (
        <span className="absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-mauve-dark px-1 text-xs leading-none tabular-nums text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
