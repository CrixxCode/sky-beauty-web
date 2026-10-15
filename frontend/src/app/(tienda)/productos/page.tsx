import { Container } from '@/components/layout/container';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  ActiveFilters,
  CatalogFilters,
  catalogHref,
  EmptyCatalog,
  flattenCategories,
  MobileCategoryChips,
  ProductGrid,
  StorePageHeading,
  type CatalogParams,
} from '@/features/storefront/catalog-ui';
import { MobileFiltersSheet } from '@/features/storefront/mobile-filters-sheet';
import { fetchPublicApi } from '@/lib/api.server';
import { pageList } from '@/lib/pagination';
import type { PaginatedPublicProducts, PublicBrand, PublicCategory } from '@/types/catalog';

/** Productos por página: llena filas completas con 4 columnas (escritorio) y 2 (celular). */
const PAGE_SIZE = 24;

type ProductosPageProps = {
  searchParams: Promise<{
    categoria?: string;
    marca?: string;
    q?: string;
    ofertas?: string;
    pagina?: string;
  }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validId(value: string | undefined): string | undefined {
  return value && UUID_PATTERN.test(value) ? value : undefined;
}

export default async function ProductosPage({ searchParams }: ProductosPageProps) {
  const { pagina, ...rest } = await searchParams;
  // Un identificador mal formado en la URL (enlace roto o editado a mano) se ignora como filtro:
  // la API lo rechazaría y la página mostraría un error en lugar del catálogo.
  const params: CatalogParams = {
    categoria: validId(rest.categoria),
    marca: validId(rest.marca),
    q: rest.q?.trim() || undefined,
    ofertas: rest.ofertas === '1' ? '1' : undefined,
  };
  const page = Math.max(1, Number.parseInt(pagina ?? '1', 10) || 1);

  const query = new URLSearchParams();
  query.set('limit', String(PAGE_SIZE));
  query.set('page', String(page));
  if (params.categoria) query.set('categoryId', params.categoria);
  if (params.marca) query.set('brandId', params.marca);
  if (params.q) query.set('q', params.q);
  // Las ofertas salen ordenadas por descuento, de mayor a menor.
  if (params.ofertas) query.set('onSale', 'true');

  const [productsData, categories, brands] = await Promise.all([
    fetchPublicApi<PaginatedPublicProducts>(`/store/products?${query.toString()}`),
    fetchPublicApi<PublicCategory[]>('/store/categories'),
    fetchPublicApi<PublicBrand[]>('/store/brands'),
  ]);
  const products = productsData?.items ?? [];
  const total = productsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(total, first + products.length - 1);

  const categoryName = flattenCategories(categories ?? []).find(
    (category) => category.id === params.categoria,
  )?.name;
  const brandName = (brands ?? []).find((brand) => brand.id === params.marca)?.name;
  const activeCount = [params.categoria, params.marca, params.q, params.ofertas].filter(
    Boolean,
  ).length;
  const title = params.q
    ? `Resultados para “${params.q}”`
    : [params.ofertas && 'Ofertas', categoryName, brandName].filter(Boolean).join(' · ') ||
      'Productos disponibles';

  const filters = (
    <CatalogFilters categories={categories ?? []} brands={brands ?? []} params={params} />
  );

  return (
    <Container className="min-h-[70vh] py-16.25 max-[600px]:py-11.25">
      <StorePageHeading
        eyebrow="Catálogo"
        title={title}
        description={
          params.ofertas
            ? 'Productos con una promoción vigente, del mayor al menor descuento. El descuento ya está aplicado en el precio.'
            : 'Filtra por categoría, marca o búsqueda para encontrar productos publicados en la tienda.'
        }
      />
      <div className="mb-5 flex items-center justify-between gap-2.5 border-y border-[#ece5e7] py-3 text-xs text-[#6a5e65]">
        <p aria-live="polite" className="tabular-nums">
          {total === 0 ? (
            'Sin resultados'
          ) : totalPages > 1 && products.length > 0 ? (
            <>
              Mostrando <strong>{first}</strong>–<strong>{last}</strong> de <strong>{total}</strong>{' '}
              productos
            </>
          ) : (
            <>
              <strong>{total}</strong>{' '}
              {total === 1 ? 'producto encontrado' : 'productos encontrados'}
            </>
          )}
        </p>
        <MobileFiltersSheet activeCount={activeCount}>{filters}</MobileFiltersSheet>
      </div>
      <MobileCategoryChips categories={categories ?? []} params={params} />
      <ActiveFilters params={params} categoryName={categoryName} brandName={brandName} />
      <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-10.5 max-[850px]:grid-cols-[190px_minmax(0,1fr)] max-[600px]:block">
        <aside aria-label="Filtros" className="max-[600px]:hidden">
          {filters}
        </aside>
        <section aria-labelledby="resultados">
          <h2 id="resultados" className="sr-only">
            Productos
          </h2>
          {products.length > 0 ? (
            <ProductGrid
              products={products}
              brands={brands ?? []}
              categories={categories ?? []}
              eagerCount={4}
            />
          ) : (
            <EmptyCatalog filtered={activeCount > 0 || page > 1} />
          )}
          {totalPages > 1 && (
            <Pagination className="mt-12">
              <PaginationContent>
                {page > 1 && (
                  <PaginationItem>
                    <PaginationPrevious href={catalogHref(params, {}, page - 1)} />
                  </PaginationItem>
                )}
                {pageList(page, totalPages).map((item, index) =>
                  item === 'gap' ? (
                    <PaginationItem key={`gap-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink
                        href={catalogHref(params, {}, item)}
                        isActive={item === page}
                        aria-label={`Página ${item}`}
                      >
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                {page < totalPages && (
                  <PaginationItem>
                    <PaginationNext href={catalogHref(params, {}, page + 1)} />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
        </section>
      </div>
    </Container>
  );
}
