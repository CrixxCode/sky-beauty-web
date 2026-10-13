import { SlidersHorizontal } from 'lucide-react';
import { Container } from '@/components/layout/container';
import {
  CatalogFilters,
  EmptyCatalog,
  MobileFilterLinks,
  ProductGrid,
  StorePageHeading,
} from '@/features/storefront/catalog-ui';
import { fetchPublicApi } from '@/lib/api.server';
import type {
  PaginatedPublicProducts,
  PublicBrand,
  PublicCategory,
} from '@/types/catalog';

type ProductosPageProps = {
  searchParams: Promise<{
    categoria?: string;
    marca?: string;
    q?: string;
  }>;
};

export default async function ProductosPage({ searchParams }: ProductosPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  query.set('limit', '60');
  if (params.categoria) query.set('categoryId', params.categoria);
  if (params.marca) query.set('brandId', params.marca);
  if (params.q) query.set('q', params.q);

  const [productsData, categories, brands] = await Promise.all([
    fetchPublicApi<PaginatedPublicProducts>(`/store/products?${query.toString()}`),
    fetchPublicApi<PublicCategory[]>('/store/categories'),
    fetchPublicApi<PublicBrand[]>('/store/brands'),
  ]);
  const products = productsData?.items ?? [];
  const total = productsData?.total ?? 0;

  return (
    <Container className="min-h-[70vh] py-16.25 max-[600px]:py-11.25">
      <StorePageHeading
        eyebrow="Catálogo"
        title="Productos disponibles"
        description="Filtra por categoría, marca o búsqueda para encontrar productos publicados en la tienda."
      />
      <div className="mb-5 flex items-center justify-between gap-2.5 border-y border-[#ece5e7] py-4 text-[11px] text-[#766a73]">
        <span>
          <strong>{total}</strong> {total === 1 ? 'producto encontrado' : 'productos encontrados'}
        </span>
        <span className="hidden items-center gap-2 max-[600px]:flex">
          <SlidersHorizontal size={16} /> Filtros
        </span>
      </div>
      <MobileFilterLinks categories={categories ?? []} brands={brands ?? []} />
      <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-10.5 max-[850px]:grid-cols-[190px_minmax(0,1fr)] max-[600px]:block">
        <CatalogFilters
          categories={categories ?? []}
          brands={brands ?? []}
          activeCategory={params.categoria}
          activeBrand={params.marca}
          query={params.q}
        />
        <div>
          {products.length > 0 ? (
            <ProductGrid products={products} brands={brands ?? []} categories={categories ?? []} />
          ) : (
            <EmptyCatalog />
          )}
        </div>
      </div>
    </Container>
  );
}
