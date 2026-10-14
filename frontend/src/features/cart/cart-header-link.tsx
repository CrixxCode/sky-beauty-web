'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { HeaderCount } from '@/components/layout/header-count';
import { useCart } from './cart-context';

export function CartHeaderLink() {
  const { count, ready } = useCart();
  return (
    <Link
      href="/carrito"
      className="relative grid h-11 w-11 place-items-center text-[#3a2c36] hover:text-[#70436f]"
      aria-label={`Bolsa de compra, ${count} ${count === 1 ? 'producto' : 'productos'}`}
    >
      <ShoppingBag size={20} strokeWidth={1.7} />
      <HeaderCount count={count} ready={ready} />
    </Link>
  );
}
