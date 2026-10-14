import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Eyebrow, serifClass, TextAction } from '@/components/ui/typography';
import { ProductGrid, ProductPhoto, productCover, StoreSearch } from '@/features/storefront/catalog-ui';
import { fetchPublicApi } from '@/lib/api.server';
import { cn } from '@/lib/utils';
import type {
  PaginatedPublicProducts,
  PublicBrand,
  PublicCategory,
} from '@/types/catalog';
import type { PublicStoreInfo } from '@/types/store';

export default async function InicioPage() {
  const [info, productsData, categories, brands] = await Promise.all([
    fetchPublicApi<PublicStoreInfo>('/store/info'),
    fetchPublicApi<PaginatedPublicProducts>('/store/products?limit=8'),
    fetchPublicApi<PublicCategory[]>('/store/categories'),
    fetchPublicApi<PublicBrand[]>('/store/brands'),
  ]);
  const products = productsData?.items ?? [];
  const heroProduct = products.find((product) => product.isFeatured) ?? products[0] ?? null;
  const featured = products.filter((product) => product.isFeatured).slice(0, 4);
  const visibleProducts = featured.length > 0 ? featured : products.slice(0, 4);
  // Los textos del inicio salen de la configuración de la tienda (su edición llega con el
  // módulo 12). Sin textos configurados solo se muestra el nombre de la tienda.
  const storeName = info?.storeName ?? 'Sky Beauty Maquillaje';
  const heroTitle = info?.heroTitle ?? storeName;
  const heroSubtitle = info?.heroSubtitle ?? null;

  return (
    <>
      <section className="overflow-hidden bg-ivory">
        <Container className="grid min-h-148.75 grid-cols-[52%_48%] max-[1150px]:min-h-130 max-[850px]:min-h-122.5 max-[850px]:grid-cols-2 max-[600px]:min-h-0 max-[600px]:grid-cols-1">
          <div className="flex flex-col justify-center py-25.75 pr-11.25 max-[600px]:min-h-103.75 max-[600px]:py-13.75 max-[600px]:pr-0">
            {info?.heroTitle && <Eyebrow className="mb-6">{storeName}</Eyebrow>}
            <h1 className={cn(serifClass, 'mb-6.5 max-w-160 text-[clamp(66px,7.5vw,112px)] leading-[1.1] max-[600px]:text-[clamp(64px,13vw,87px)]')}>
              {heroTitle}
            </h1>
            {heroSubtitle && (
              <p className="max-w-106 text-[13px] leading-[2.05] text-[#6a5e60] max-[600px]:text-xs">
                {heroSubtitle}
              </p>
            )}
            <div className="mt-7.75 flex flex-wrap gap-2.75">
              <StoreSearch compact />
              <Button asChild>
                <Link href="/productos">
                  Ver productos <ArrowRight size={17} />
                </Link>
              </Button>
            </div>
          </div>
          <div className="relative min-h-148.75 overflow-hidden max-[1150px]:min-h-130 max-[850px]:min-h-122.5 max-[600px]:-mx-4.25 max-[600px]:min-h-100">
            {/* Posición absoluta: la foto llena el bloque sin que su tamaño original lo agrande. */}
            <ProductPhoto
              src={heroProduct ? productCover(heroProduct, 'full') : null}
              alt={heroProduct?.name ?? 'Producto de Sky Beauty'}
              className="absolute inset-0 object-[center_27%]"
            />
            <div className="absolute inset-0 bg-linear-to-b from-transparent from-60% to-[#4d394240]" />
            {heroProduct && (
              <Link
                href={`/producto/${heroProduct.slug}`}
                className="absolute bottom-11.25 left-11.25 z-10 text-white max-[600px]:bottom-6.75 max-[600px]:left-6.75"
              >
                <span className={cn(serifClass, 'block text-[29px] leading-[1.3]')}>
                  {heroProduct.name}
                </span>
                <span className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold">
                  Ver detalle <ArrowRight size={15} />
                </span>
              </Link>
            )}
          </div>
        </Container>
      </section>

      <Container className="py-23 max-[600px]:py-16.25">
        <div className="mb-8.5 flex items-end justify-between gap-4">
          <div>
            <Eyebrow>Categorías</Eyebrow>
            <h2 className={cn(serifClass, 'mt-1.25 text-[clamp(32px,4vw,46px)] leading-[1.24]')}>
              Explora por tipo de producto
            </h2>
          </div>
          <TextAction href="/productos">
            Ver todo <ArrowRight size={16} />
          </TextAction>
        </div>
        <div className="grid grid-cols-6 gap-4.25 max-[850px]:grid-cols-3 max-[600px]:gap-2.75">
          {(categories ?? [])
            .flatMap((category) => [category, ...category.children])
            .slice(0, 6)
            .map((category, index) => (
              <Link key={category.id} href={`/productos?categoria=${category.id}`} className="min-w-0">
                <div className={cn('h-50 overflow-hidden bg-[#f4eff2] max-[850px]:h-66.25 max-[600px]:h-36.25', index % 2 === 0 ? 'rounded-t-full' : 'rounded-t-[12px]')}>
                  <div className="flex h-full items-center justify-center bg-[#f3e8f1] px-3 text-center text-xs font-semibold text-[#70416e]">
                    {category.name}
                  </div>
                </div>
              </Link>
            ))}
        </div>
      </Container>

      {visibleProducts.length > 0 && (
        <Container className="pb-23 max-[600px]:pb-16.25">
          <div className="mb-8.5 flex items-end justify-between gap-4">
            <div>
              <Eyebrow>Productos</Eyebrow>
              <h2 className={cn(serifClass, 'mt-1.25 text-[clamp(32px,4vw,46px)] leading-[1.24]')}>
                Disponibles en la tienda
              </h2>
            </div>
            <TextAction href="/productos">
              Ver catálogo <ArrowRight size={16} />
            </TextAction>
          </div>
          <ProductGrid products={visibleProducts} brands={brands ?? []} categories={categories ?? []} />
        </Container>
      )}
    </>
  );
}
