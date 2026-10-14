'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Heart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { serifClass } from '@/components/ui/typography';
import { ProductGrid } from '@/features/storefront/catalog-ui';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PaginatedPublicProducts, PublicBrand, PublicCategory } from '@/types/catalog';
import { MAX_FAVORITES, useFavorites } from './favorites-context';

/**
 * Productos guardados en favoritos (en este navegador). Muestra solo los que siguen publicados y
 * ofrece quitar los que ya no lo están.
 */
export function FavoritesPage({
  brands,
  categories,
}: {
  brands: PublicBrand[];
  categories: PublicCategory[];
}) {
  const { ids, ready, keepOnly } = useFavorites();
  const key = ids.join(',');
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['store-favorites', key],
    queryFn: () =>
      apiFetch<PaginatedPublicProducts>(
        `/store/products?ids=${encodeURIComponent(key)}&limit=${MAX_FAVORITES}`,
      ),
    enabled: ready && ids.length > 0,
  });

  if (!ready || (ids.length > 0 && isPending)) {
    return (
      <p aria-live="polite" className="py-10 text-xs text-[#6a5e65]">
        Cargando tus favoritos…
      </p>
    );
  }

  if (ids.length === 0) {
    return (
      <EmptyFavorites
        title="Aún no tienes favoritos"
        detail="Toca el corazón de un producto para guardarlo aquí y encontrarlo después."
      />
    );
  }

  if (isError) {
    return (
      <div className="py-10 text-xs text-[#6a5e65]">
        <p className="mb-4">No pudimos cargar tus favoritos.</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Intentar de nuevo
        </Button>
      </div>
    );
  }

  // La API los devuelve por fecha de publicación; se muestran en el orden en que se guardaron.
  const byId = new Map((data?.items ?? []).map((product) => [product.id, product]));
  const products = ids.flatMap((id) => byId.get(id) ?? []);
  const missing = ids.length - products.length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2.5 border-y border-[#ece5e7] py-3 text-xs text-[#6a5e65]">
        <p aria-live="polite" className="tabular-nums">
          <strong>{products.length}</strong>{' '}
          {products.length === 1 ? 'producto guardado' : 'productos guardados'}
        </p>
        {missing > 0 && (
          <p className="flex flex-wrap items-center gap-2">
            {missing === 1
              ? 'Un producto que guardaste ya no está disponible.'
              : `${missing} productos que guardaste ya no están disponibles.`}
            <Button
              variant="link"
              onClick={() => keepOnly(products.map((product) => product.id))}
              className="min-h-11"
            >
              Quitar de favoritos
            </Button>
          </p>
        )}
      </div>
      {products.length > 0 ? (
        <ProductGrid products={products} brands={brands} categories={categories} eagerCount={4} />
      ) : (
        <EmptyFavorites
          title="Tus favoritos ya no están disponibles"
          detail="Los productos que guardaste ya no están publicados en la tienda."
        />
      )}
    </>
  );
}

function EmptyFavorites({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto my-8.75 flex max-w-140 flex-col items-center bg-[#faf6f8] px-6 py-15 text-center">
      <div className="grid h-16.25 w-16.25 place-items-center rounded-full bg-[#eee0ed] text-[#825a87]">
        <Heart aria-hidden="true" />
      </div>
      <h2 className={cn(serifClass, 'mb-2.5 mt-4.75 text-balance text-[31px]')}>{title}</h2>
      <p className="mb-6.5 max-w-96 text-xs leading-[1.85] text-[#72646a]">{detail}</p>
      <Button asChild>
        <Link href="/productos">
          Explorar productos <ArrowRight size={16} />
        </Link>
      </Button>
    </div>
  );
}
