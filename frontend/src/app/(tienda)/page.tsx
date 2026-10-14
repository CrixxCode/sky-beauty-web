import { ArrowDown, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Eyebrow, serifClass } from '@/components/ui/typography';
import { ProductPhoto, productCover } from '@/features/storefront/catalog-ui';
import { HeroCarousel } from '@/features/storefront/hero-carousel';
import {
  BenefitsStrip,
  BrandShowcase,
  CategoryShowcase,
  CommunitySection,
  FinderSection,
  HeroSlide,
  OffersShowcase,
  ProductShowcase,
  TestimonialsSection,
  WhatsappFloat,
} from '@/features/storefront/home-sections';
import { fetchPublicApi, fetchPublicApiOptional } from '@/lib/api.server';
import { cn } from '@/lib/utils';
import type {
  PaginatedPublicProducts,
  PublicBrand,
  PublicCategory,
  PublicProduct,
} from '@/types/catalog';
import type { PublicStoreInfo } from '@/types/store';
import type { PublicTestimonial } from '@/types/testimonials';

/**
 * Productos recientes que lee el inicio (del más nuevo al más antiguo): de ellos salen las
 * novedades, "Más para descubrir" y las fotos de las categorías.
 */
const RECENT_COUNT = 48;

/** Productos de cada vitrina. */
const NEW_COUNT = 8;
const SHOWCASE_COUNT = 4;
const OFFERS_COUNT = 8;
const HERO_SLIDES = 3;
/** Destacados que se leen: alcanzan para el carrusel y la vitrina sin repetir las novedades. */
const FEATURED_COUNT = 12;

const hasPhoto = (product: PublicProduct) => productCover(product) !== null;

export default async function InicioPage() {
  const [info, productsData, featuredData, offersData, categories, brands, testimonials] =
    await Promise.all([
      fetchPublicApi<PublicStoreInfo>('/store/info'),
      fetchPublicApi<PaginatedPublicProducts>(`/store/products?limit=${RECENT_COUNT}`),
      fetchPublicApi<PaginatedPublicProducts>(
        `/store/products?featured=true&limit=${FEATURED_COUNT}`,
      ),
      // La API las devuelve ordenadas del mayor al menor descuento.
      fetchPublicApi<PaginatedPublicProducts>(`/store/products?onSale=true&limit=${OFFERS_COUNT}`),
      fetchPublicApi<PublicCategory[]>('/store/categories'),
      fetchPublicApi<PublicBrand[]>('/store/brands'),
      // Los testimonios son complementarios: si fallan, el inicio se muestra sin ellos.
      fetchPublicApiOptional<PublicTestimonial[]>('/store/testimonials'),
    ]);
  const products = productsData?.items ?? [];
  const allCategories = categories ?? [];
  const allBrands = brands ?? [];

  // Los textos del inicio salen de la configuración de la tienda (panel → Contenido). Sin textos
  // configurados solo se muestra el nombre de la tienda.
  const storeName = info?.storeName ?? 'Sky Beauty Maquillaje';
  const heroTitle = info?.heroTitle ?? storeName;
  const heroSubtitle = info?.heroSubtitle ?? null;

  // Carrusel: hasta 3 productos destacados con foto; si no hay, los más recientes con foto.
  const featured = featuredData?.items ?? [];
  const featuredWithPhoto = featured.filter(hasPhoto);
  const heroProducts = (
    featuredWithPhoto.length > 0 ? featuredWithPhoto : products.filter(hasPhoto)
  ).slice(0, HERO_SLIDES);

  // Vitrinas sin repetir productos entre sí, salvo las ofertas (las de mayor descuento, aunque
  // ya aparezcan en otra vitrina).
  const newest = products.slice(0, NEW_COUNT);
  const shown = new Set(newest.map((product) => product.id));
  const highlighted = featured.filter((product) => !shown.has(product.id)).slice(0, SHOWCASE_COUNT);
  highlighted.forEach((product) => shown.add(product.id));
  const offers = offersData?.items ?? [];
  offers.forEach((product) => shown.add(product.id));
  const discover = products.filter((product) => !shown.has(product.id)).slice(0, SHOWCASE_COUNT);

  return (
    <>
      {/* @container: el carrusel calcula con el ancho de la sección (cqw) cuánto le falta para
          llegar al borde derecho de la pantalla. */}
      <section aria-label="Presentación" className="@container overflow-hidden bg-ivory">
        <Container className="grid min-h-148.75 grid-cols-[52%_48%] max-[1150px]:min-h-130 max-[850px]:min-h-122.5 max-[850px]:grid-cols-2 max-[600px]:min-h-0 max-[600px]:grid-cols-1">
          <div className="flex flex-col justify-center py-25.75 pr-11.25 max-[850px]:py-16 max-[850px]:pr-6.25 max-[600px]:py-12 max-[600px]:pr-0">
            {info?.heroTitle && <Eyebrow className="mb-6 max-[600px]:mb-4">{storeName}</Eyebrow>}
            <h1
              className={cn(
                serifClass,
                'mb-6.5 max-w-160 text-balance wrap-break-word text-[clamp(56px,7.5vw,112px)] leading-[1.1] max-[850px]:text-[clamp(44px,7vw,64px)] max-[600px]:text-[clamp(40px,12vw,60px)]',
              )}
            >
              {heroTitle}
            </h1>
            {heroSubtitle && (
              <p className="max-w-106 text-pretty text-[13px] leading-[2.05] text-[#6a5e60] max-[600px]:text-sm">
                {heroSubtitle}
              </p>
            )}
            <div className="mt-7.75 flex flex-wrap gap-2.75 max-[600px]:mt-6">
              <Button asChild className="max-[380px]:w-full">
                <Link href="/productos">
                  Explorar productos <ArrowRight size={17} />
                </Link>
              </Button>
              {newest.length > 0 && (
                <Button asChild variant="outline" className="max-[380px]:w-full">
                  <Link href="#novedades">
                    Ver novedades <ArrowDown size={16} />
                  </Link>
                </Button>
              )}
            </div>
          </div>
          {/* El carrusel llega hasta el borde derecho de la pantalla: el margen negativo es el
              espacio lateral del Container en cada ancho (en celular ocupa todo el ancho). */}
          <div className="relative min-h-148.75 overflow-hidden max-[1150px]:min-h-130 max-[850px]:min-h-122.5 max-[600px]:-mx-4.25 max-[600px]:min-h-100 min-[601px]:-mr-4.5 min-[851px]:-mr-6.25 min-[1151px]:-mr-[max(36px,calc(50cqw-640px))]">
            {heroProducts.length > 0 ? (
              <HeroCarousel label="Productos destacados" className="absolute inset-0">
                {heroProducts.map((product, index) => (
                  <HeroSlide key={product.id} product={product} first={index === 0} />
                ))}
              </HeroCarousel>
            ) : (
              <ProductPhoto src={null} alt="Productos de Sky Beauty" className="absolute inset-0" />
            )}
          </div>
        </Container>
      </section>

      <CategoryShowcase categories={allCategories} products={products} />

      <ProductShowcase
        id="novedades"
        eyebrow="Novedades"
        title="Recién llegados"
        description="Lo último que llegó a la tienda."
        action={{ href: '/productos', label: 'Ver más novedades' }}
        products={newest}
        brands={allBrands}
        categories={allCategories}
      />

      {/* Sin datos de ventas públicos: es la selección que la tienda marca como destacada, sin
          decir que son los más vendidos. */}
      <ProductShowcase
        id="destacados"
        eyebrow="Selección Sky Beauty"
        title="Productos destacados"
        description="Una selección especial de la tienda."
        products={highlighted}
        brands={allBrands}
        categories={allCategories}
        className="bg-[#fbf8f5]"
      />

      <BrandShowcase brands={allBrands} />

      <OffersShowcase
        products={offers}
        total={offersData?.total ?? 0}
        brands={allBrands}
        categories={allCategories}
      />

      <FinderSection categories={allCategories} brands={allBrands} />

      <ProductShowcase
        id="descubre"
        eyebrow="Sigue explorando"
        title="Más para descubrir"
        action={{ href: '/productos', label: 'Ver el catálogo' }}
        products={discover}
        brands={allBrands}
        categories={allCategories}
      />

      <BenefitsStrip hasWhatsapp={Boolean(info?.whatsappNumber)} />

      <TestimonialsSection testimonials={testimonials ?? []} />

      <CommunitySection info={info} />

      {info?.whatsappNumber && <WhatsappFloat number={info.whatsappNumber} />}
    </>
  );
}
