import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/layout/brand-logo';
import { Container } from '@/components/layout/container';
import { StoreFooter } from '@/components/layout/store-footer';
import { StoreSearch } from '@/features/storefront/catalog-ui';
import { fetchPublicApi } from '@/lib/api.server';
import type { PublicCategory } from '@/types/catalog';
import type { PublicStoreInfo } from '@/types/store';

export default async function TiendaLayout({ children }: { children: ReactNode }) {
  const [info, categories] = await Promise.all([
    fetchPublicApi<PublicStoreInfo>('/store/info'),
    fetchPublicApi<PublicCategory[]>('/store/categories'),
  ]);
  const navCategories = (categories ?? [])
    .flatMap((category) => [category, ...category.children])
    .slice(0, 6);

  return (
    <>
      <header className="relative z-50 border-b border-[#eee9e6] bg-paper/98">
        <Container className="flex h-22.5 items-center justify-between gap-9.5 max-[850px]:h-20 max-[600px]:h-17.25">
          <Link href="/" aria-label="Inicio de Sky Beauty">
            <BrandLogo />
          </Link>
          <div className="flex flex-1 justify-center max-[600px]:hidden">
            <StoreSearch />
          </div>
          <Link
            href="/productos"
            className="text-[11px] font-semibold text-[#794b79] max-[600px]:text-[10px]"
          >
            Catálogo
          </Link>
        </Container>
        <Container className="flex h-11.5 items-center justify-center gap-6.75 overflow-x-auto max-[600px]:hidden">
          <Link
            href="/productos"
            className="shrink-0 text-[10px] text-[#534850] hover:text-[#9c649a]"
          >
            Ver todo
          </Link>
          {navCategories.map((category) => (
            <Link
              key={category.id}
              href={`/productos?categoria=${category.id}`}
              className="shrink-0 text-[10px] text-[#534850] hover:text-[#9c649a]"
            >
              {category.name}
            </Link>
          ))}
        </Container>
      </header>
      <Container className="mb-3 hidden h-10.75 items-center bg-[#f8f4f5] max-[600px]:flex">
        <StoreSearch compact />
      </Container>
      <main className="flex-1">{children}</main>
      <StoreFooter info={info} />
    </>
  );
}
