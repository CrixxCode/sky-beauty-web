'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useCart } from './cart-context';

export function CartHeaderLink() {
  const { count } = useCart();
  return (
    <Link
      href="/carrito"
      className="relative grid h-9.5 w-9.5 place-items-center text-[#3a2c36]"
      aria-label={`Bolsa de compra, ${count} productos`}
    >
      <ShoppingBag size={20} strokeWidth={1.7} />
      {count > 0 && (
        <span className="absolute right-0 top-0 grid h-4.25 w-4.25 place-items-center rounded-full bg-mauve-dark text-[9px] text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
