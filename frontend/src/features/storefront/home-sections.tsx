import {
  ArrowRight,
  ArrowUpRight,
  CircleCheck,
  MessageCircle,
  PackageSearch,
  ShoppingBag,
  Sparkles,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Eyebrow, serifClass, TextAction } from '@/components/ui/typography';
import { formatCOP, whatsappUrl } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicBrand, PublicCategory, PublicProduct } from '@/types/catalog';
import type { PublicStoreInfo } from '@/types/store';
import type { PublicTestimonial } from '@/types/testimonials';
import {
  discountPercent,
  flattenCategories,
  ProductCard,
  ProductPhoto,
  productCover,
  productPrice,
  productRegularPrice,
} from './catalog-ui';
import { ProductFinder } from './product-finder';

/** Separación vertical entre secciones (replica .section-spacing del prototipo). */
const sectionSpacing = 'py-23 max-[600px]:py-16.25';

const h2Class = cn(serifClass, 'mt-1.25 text-balance text-[clamp(32px,4vw,46px)] leading-[1.24]');

/** Fila con desplazamiento horizontal en celular y tableta (se desliza con el dedo). */
const railClass =
  'max-[850px]:-mx-4.25 max-[850px]:flex max-[850px]:snap-x max-[850px]:snap-mandatory max-[850px]:overflow-x-auto max-[850px]:overscroll-x-contain max-[850px]:scroll-px-4.25 max-[850px]:px-4.25 max-[850px]:pb-2 max-[850px]:[scrollbar-width:none] max-[850px]:[&::-webkit-scrollbar]:hidden min-[601px]:max-[850px]:-mx-4.5 min-[601px]:max-[850px]:scroll-px-4.5 min-[601px]:max-[850px]:px-4.5';

/** Encabezado de sección: antetítulo, título y enlace opcional (replica .section-head). */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  action,
  center = false,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  center?: boolean;
}) {
  return (
    <div
      className={cn(
        'mb-8.5 flex items-end justify-between gap-4 max-[600px]:mb-6.5',
        center && 'flex-col items-center text-center',
      )}
    >
      <div className={cn(center && 'max-w-160')}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={id} className={h2Class}>
          {title}
        </h2>
        {description && (
          <p
            className={cn(
              'mt-3 max-w-140 text-pretty text-xs leading-[1.95] text-[#6a5e63]',
              center && 'mx-auto',
            )}
          >
            {description}
          </p>
        )}
      </div>
      {action && (
        <TextAction href={action.href} className="max-[600px]:hidden">
          {action.label} <ArrowRight size={16} />
        </TextAction>
      )}
    </div>
  );
}

/** Enlace de la sección repetido al final en celular, donde el encabezado no lo muestra. */
function MobileAction({ action }: { action?: { href: string; label: string } }) {
  if (!action) return null;
  return (
    <div className="mt-6 hidden justify-center min-[601px]:hidden max-[600px]:flex">
      <Button asChild variant="outline">
        <Link href={action.href}>
          {action.label} <ArrowRight size={16} />
        </Link>
      </Button>
    </div>
  );
}

/**
 * Productos en cuadrícula de cuatro columnas en escritorio y en fila deslizable en celular y
 * tableta.
 */
export function ProductRail({
  products,
  brands,
  categories,
  label,
}: {
  products: PublicProduct[];
  brands: PublicBrand[];
  categories: PublicCategory[];
  label: string;
}) {
  const brandMap = new Map(brands.map((brand) => [brand.id, brand]));
  const categoryMap = new Map(
    flattenCategories(categories).map((category) => [category.id, category] as const),
  );

  return (
    <ul
      aria-label={label}
      className={cn(
        'grid grid-cols-4 gap-x-5.5 gap-y-8.75 max-[850px]:gap-x-3.5 max-[600px]:gap-x-2.75',
        railClass,
      )}
    >
      {products.map((product) => (
        <li
          key={product.id}
          className="relative min-w-0 max-[850px]:w-[42%] max-[850px]:shrink-0 max-[850px]:snap-start max-[600px]:w-[46%]"
        >
          <ProductCard
            product={product}
            brand={brandMap.get(product.brandId)}
            category={categoryMap.get(product.categoryId)}
          />
        </li>
      ))}
    </ul>
  );
}

/** Sección de productos con encabezado (novedades, destacados, más para descubrir). */
export function ProductShowcase({
  id,
  eyebrow,
  title,
  description,
  action,
  products,
  brands,
  categories,
  className,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
  products: PublicProduct[];
  brands: PublicBrand[];
  categories: PublicCategory[];
  className?: string;
}) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby={`${id}-titulo`} id={id} className={cn('scroll-mt-4', className)}>
      <Container className={sectionSpacing}>
        <SectionHeading
          id={`${id}-titulo`}
          eyebrow={eyebrow}
          title={title}
          description={description}
          action={action}
        />
        <ProductRail products={products} brands={brands} categories={categories} label={title} />
        <MobileAction action={action} />
      </Container>
    </section>
  );
}

/** Precio de la diapositiva: "Desde" solo si las variantes tienen precios distintos. */
function heroPrice(product: PublicProduct): string {
  const prices = new Set(product.variants.map((variant) => variant.finalPrice));
  const price = formatCOP(productPrice(product));
  return prices.size > 1 ? `Desde ${price}` : price;
}

/** Diapositiva del carrusel del inicio: foto del producto, nombre, precio y enlace al detalle. */
export function HeroSlide({ product, first }: { product: PublicProduct; first: boolean }) {
  const percent = discountPercent(productRegularPrice(product), productPrice(product));
  return (
    <>
      {/* Posición absoluta: la foto llena el bloque sin que su tamaño original lo agrande. */}
      <ProductPhoto
        src={productCover(product, 'full')}
        alt={product.name}
        className="absolute inset-0 object-[center_27%]"
        priority={first}
        size={1600}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-b from-transparent from-45% to-[#4d394299]"
      />
      <Link
        href={`/producto/${product.slug}`}
        className="group absolute bottom-11.25 left-11.25 right-11.25 z-10 text-white max-[850px]:bottom-7.5 max-[850px]:left-7.5 max-[850px]:right-7.5 max-[600px]:bottom-6.75 max-[600px]:left-6.75 max-[600px]:right-6.75"
      >
        {percent > 0 && (
          <span className="mb-3 inline-block bg-[#fff9f8] px-2.25 py-1.5 text-xs font-semibold text-[#94526c]">
            −{percent}%
          </span>
        )}
        <span
          className={cn(
            serifClass,
            'block text-balance text-[29px] leading-[1.3] [text-shadow:0_1px_12px_rgb(0_0_0/0.35)] max-[850px]:text-[24px]',
          )}
        >
          {product.name}
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold [text-shadow:0_1px_8px_rgb(0_0_0/0.35)]">
          <span className="tabular-nums">{heroPrice(product)}</span>
          <span className="inline-flex items-center gap-1.5 group-hover:underline">
            Ver producto <ArrowRight size={15} />
          </span>
        </span>
      </Link>
    </>
  );
}

/**
 * Categorías principales con la foto de uno de sus productos (las categorías no tienen foto
 * propia). Sin productos con foto, la tarjeta muestra un fondo de la marca.
 */
export function CategoryShowcase({
  categories,
  products,
}: {
  categories: PublicCategory[];
  products: PublicProduct[];
}) {
  const tiles = categories.slice(0, 8).map((category) => {
    const ids = new Set([category.id, ...category.children.map((child) => child.id)]);
    const cover = products.find((product) => ids.has(product.categoryId) && productCover(product));
    return { category, photo: cover ? productCover(cover) : null };
  });
  if (tiles.length === 0) return null;
  // Columnas de escritorio: todas en una fila hasta 6; con 7 u 8, dos filas de 4.
  const columns = tiles.length <= 6 ? tiles.length : 4;

  return (
    <section aria-labelledby="categorias-titulo">
      <Container className={sectionSpacing}>
        <SectionHeading
          id="categorias-titulo"
          eyebrow="Categorías"
          title="Explora por tipo de producto"
          action={{ href: '/productos', label: 'Ver todo' }}
        />
        <ul
          style={{ '--cols': Math.max(3, columns) } as CSSProperties}
          className={cn(
            'grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-x-4.25 gap-y-6.75 max-[850px]:grid-cols-3 max-[600px]:gap-x-2.75',
            'max-[600px]:-mx-4.25 max-[600px]:flex max-[600px]:snap-x max-[600px]:snap-mandatory max-[600px]:overflow-x-auto max-[600px]:scroll-px-4.25 max-[600px]:px-4.25 max-[600px]:pb-2 max-[600px]:[scrollbar-width:none] max-[600px]:[&::-webkit-scrollbar]:hidden',
          )}
        >
          {tiles.map(({ category, photo }) => (
            <li
              key={category.id}
              className="min-w-0 max-[600px]:w-[38%] max-[600px]:shrink-0 max-[600px]:snap-start"
            >
              <Link href={`/productos?categoria=${category.id}`} className="group block">
                <span className="relative block h-50 overflow-hidden rounded-t-[140px] rounded-b-[12px] bg-linear-to-b from-[#f3e8f1] to-[#e8d5e7] max-[850px]:h-66.25 max-[600px]:h-40">
                  {photo ? (
                    <ProductPhoto
                      src={photo}
                      alt=""
                      className="transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <span className="grid h-full place-items-center text-[#9a6c98]">
                      <Sparkles size={26} strokeWidth={1.3} aria-hidden="true" />
                    </span>
                  )}
                </span>
                <span className="mt-3.5 flex items-center justify-between gap-2 text-[#50444d]">
                  <span className="line-clamp-2 wrap-break-word text-xs font-medium group-hover:text-[#70436f] max-[600px]:text-[13px]">
                    {category.name}
                  </span>
                  <ArrowUpRight
                    size={15}
                    aria-hidden="true"
                    className="shrink-0 text-[#a277a0] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** Marcas que vende la tienda, con enlace a sus productos (replica .brand-showcase). */
export function BrandShowcase({ brands }: { brands: PublicBrand[] }) {
  if (brands.length === 0) return null;
  const visible = brands.slice(0, 10);

  return (
    <section aria-labelledby="marcas-titulo" className="bg-[#f8f5f1]">
      <Container className={sectionSpacing}>
        <SectionHeading
          id="marcas-titulo"
          eyebrow="Marcas"
          title="Tus marcas favoritas en un solo lugar"
          center
        />
        <ul
          className={cn(
            'grid grid-cols-5 border-y border-[#e9e0e5] max-[850px]:grid-cols-3',
            'max-[600px]:-mx-4.25 max-[600px]:flex max-[600px]:snap-x max-[600px]:overflow-x-auto max-[600px]:scroll-px-4.25 max-[600px]:px-4.25 max-[600px]:[scrollbar-width:none] max-[600px]:[&::-webkit-scrollbar]:hidden',
          )}
        >
          {visible.map((brand) => (
            <li
              key={brand.id}
              className="min-w-0 border-[#e9e0e5] max-[600px]:w-[42%] max-[600px]:shrink-0 max-[600px]:snap-start min-[601px]:border-r min-[601px]:[&:nth-child(n+6)]:border-t min-[601px]:max-[850px]:[&:nth-child(3n)]:border-r-0 min-[601px]:max-[850px]:[&:nth-child(n+4)]:border-t min-[851px]:[&:nth-child(5n)]:border-r-0 max-[600px]:border-r max-[600px]:last:border-r-0"
            >
              <Link
                href={`/productos?marca=${brand.id}`}
                className="group flex h-31.25 flex-col items-center justify-center gap-1.75 px-3 text-center hover:bg-[#fffcf9]"
              >
                <span aria-hidden="true" className="text-[#b889b2]">
                  ✧
                </span>
                <strong
                  className={cn(
                    serifClass,
                    'line-clamp-2 wrap-break-word text-lg font-medium text-ink group-hover:text-[#70436f]',
                  )}
                >
                  {brand.name}
                </strong>
                <span className="text-xs text-[#7a6d74]">Ver productos</span>
              </Link>
            </li>
          ))}
        </ul>
        {brands.length > visible.length && (
          <div className="mt-7 flex justify-center">
            <TextAction href="/productos">
              Ver todas las marcas en el catálogo <ArrowRight size={16} />
            </TextAction>
          </div>
        )}
      </Container>
    </section>
  );
}

/**
 * Ofertas: franja con el mayor descuento vigente y los productos con promoción. Los precios y
 * porcentajes los calcula la API con las promociones vigentes; aquí solo se ordenan.
 */
export function OffersShowcase({
  products,
  total,
  brands,
  categories,
}: {
  /** Las de mayor descuento (la API las ordena así). */
  products: PublicProduct[];
  /** Cuántos productos están en oferta en total. */
  total: number;
  brands: PublicBrand[];
  categories: PublicCategory[];
}) {
  if (products.length === 0) return null;
  const best = Math.max(
    ...products.map((product) =>
      discountPercent(productRegularPrice(product), productPrice(product)),
    ),
  );

  return (
    <section aria-labelledby="ofertas-titulo" id="ofertas" className="scroll-mt-4">
      <Container className={sectionSpacing}>
        <div className="mb-8.5 grid grid-cols-[1fr_auto] items-center gap-6 overflow-hidden bg-linear-to-br from-mauve-dark to-[#8f5b8e] px-11.25 py-10 text-white max-[600px]:mb-6.5 max-[600px]:grid-cols-1 max-[600px]:px-6.75 max-[600px]:py-8">
          <div>
            <Eyebrow className="text-[#fbeefa]">Ofertas</Eyebrow>
            <h2
              id="ofertas-titulo"
              className={cn(
                serifClass,
                'mt-1.25 text-balance text-[clamp(32px,4vw,52px)] leading-[1.2]',
              )}
            >
              Precios especiales
            </h2>
            <p className="mt-3 max-w-110 text-pretty text-xs leading-[1.95] text-[#f6e9f4]">
              Productos con una promoción vigente. El descuento ya está aplicado en el precio que
              ves.
            </p>
          </div>
          <div className="flex flex-col items-end gap-4 max-[600px]:items-start">
            {best > 0 && (
              <p className="text-right max-[600px]:text-left">
                <span className="block text-xs uppercase tracking-[.18em] text-[#fbeefa]">
                  Hasta
                </span>
                <span className={cn(serifClass, 'block text-[clamp(52px,7vw,92px)] leading-none')}>
                  −{best}%
                </span>
              </p>
            )}
            <Button asChild variant="light">
              <Link href="/productos?ofertas=1">
                {total > products.length ? `Ver las ${total} ofertas` : 'Ver ofertas'}{' '}
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
        <ProductRail
          products={products}
          brands={brands}
          categories={categories}
          label="Productos en oferta"
        />
      </Container>
    </section>
  );
}

/** Buscador guiado: tipo de producto, marca y nombre, con los filtros reales del catálogo. */
export function FinderSection({
  categories,
  brands,
}: {
  categories: PublicCategory[];
  brands: PublicBrand[];
}) {
  if (categories.length === 0 && brands.length === 0) return null;
  return (
    <section aria-labelledby="match-titulo" className="bg-ivory">
      <Container
        className={cn(
          sectionSpacing,
          'grid grid-cols-[0.9fr_1.1fr] items-center gap-16 max-[850px]:grid-cols-1 max-[850px]:gap-8',
        )}
      >
        <div>
          <Eyebrow>Encuentra tu producto</Eyebrow>
          <h2 id="match-titulo" className={h2Class}>
            Descubre tu match de belleza
          </h2>
          <p className="mt-4 max-w-110 text-pretty text-xs leading-[1.95] text-[#6a5e63]">
            Elige el tipo de producto y la marca que prefieres, o escribe el nombre de lo que
            buscas. Te mostramos lo que está publicado en la tienda.
          </p>
        </div>
        <ProductFinder categories={categories} brands={brands} />
      </Container>
    </section>
  );
}

/**
 * Franja de confianza. Solo dice lo que la tienda ya hace (Context/): compra sin cuenta, pedido
 * por WhatsApp, seguimiento con código y teléfono, y disponibilidad por variante.
 */
export function BenefitsStrip({ hasWhatsapp }: { hasWhatsapp: boolean }) {
  const items: Array<{ icon: ReactNode; title: string; text: string; href?: string }> = [
    {
      icon: <ShoppingBag />,
      title: 'Compra sin registrarte',
      text: 'Haz tu pedido solo con tus datos de entrega, sin crear una cuenta.',
    },
    ...(hasWhatsapp
      ? [
          {
            icon: <MessageCircle />,
            title: 'Atención por WhatsApp',
            text: 'Tu pedido continúa por WhatsApp, directamente con la tienda.',
          },
        ]
      : []),
    {
      icon: <PackageSearch />,
      title: 'Sigue tu pedido',
      text: 'Consulta su estado con el código del pedido y tu teléfono.',
      href: '/rastrear',
    },
    {
      icon: <CircleCheck />,
      title: 'Disponibilidad clara',
      text: 'Ves qué tonos y presentaciones están disponibles antes de comprar.',
    },
  ];

  return (
    <section aria-label="Por qué comprar en Sky Beauty" className="border-y border-[#ece5e5]">
      <Container
        style={{ '--cols': items.length } as CSSProperties}
        className="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-10 py-16 max-[850px]:grid-cols-2 max-[850px]:gap-8 max-[600px]:py-12"
      >
        {items.map((item) => (
          <div key={item.title} className="flex flex-col">
            <span
              className="mb-3.5 text-[#a778a7] [&>svg]:size-6 [&>svg]:stroke-[1.6]"
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <h3 className="text-sm font-semibold">{item.title}</h3>
            <p className="mt-1.5 text-xs leading-[1.9] text-[#6f6268]">{item.text}</p>
            {item.href && (
              <TextAction href={item.href} className="mt-2.5 min-h-11">
                Rastrear un pedido <ArrowRight size={15} />
              </TextAction>
            )}
          </div>
        ))}
      </Container>
    </section>
  );
}

/**
 * Testimonios que la propietaria registra y publica desde el panel (opiniones reales de
 * clientas). Sin testimonios publicados, la sección no se muestra.
 */
export function TestimonialsSection({ testimonials }: { testimonials: PublicTestimonial[] }) {
  if (testimonials.length === 0) return null;
  return (
    <section aria-labelledby="testimonios-titulo">
      <Container className={sectionSpacing}>
        <SectionHeading
          id="testimonios-titulo"
          eyebrow="Testimonios"
          title="Lo que dicen nuestras clientas"
          center
        />
        <ul className="grid grid-cols-3 gap-5.5 max-[850px]:grid-cols-2 max-[600px]:grid-cols-1">
          {testimonials.map((testimonial) => (
            <li key={testimonial.id}>
              <figure className="flex h-full flex-col border border-[#eee4ea] bg-[#fffdfb] p-6.75">
                <span
                  className="flex items-center gap-0.5"
                  role="img"
                  aria-label={`${testimonial.rating} de 5 estrellas`}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      size={15}
                      aria-hidden="true"
                      className={
                        value <= testimonial.rating
                          ? 'fill-[#a46ea4] text-[#a46ea4]'
                          : 'text-[#ddd0da]'
                      }
                    />
                  ))}
                </span>
                <blockquote className="mt-4 flex-1 whitespace-pre-line text-pretty text-[13px] leading-[1.9] text-[#4f414b]">
                  “{testimonial.comment}”
                </blockquote>
                <figcaption className="mt-5 border-t border-[#f0e7ec] pt-4 text-xs">
                  <span className="font-semibold text-ink">{testimonial.authorName}</span>
                  {testimonial.product && (
                    <span className="mt-1 block text-[#6f6268]">
                      Compró{' '}
                      <Link
                        href={`/producto/${testimonial.product.slug}`}
                        className="text-[#794b79] underline-offset-4 hover:underline"
                      >
                        {testimonial.product.name}
                      </Link>
                    </span>
                  )}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/** Redes oficiales de la tienda (las configuradas en el panel). Sin redes, no se muestra. */
export function CommunitySection({ info }: { info: PublicStoreInfo | null }) {
  const socials = [
    { label: 'Instagram', url: info?.instagramUrl },
    { label: 'Facebook', url: info?.facebookUrl },
    { label: 'TikTok', url: info?.tiktokUrl },
  ].filter((social): social is { label: string; url: string } => Boolean(social.url));
  if (socials.length === 0) return null;

  return (
    <section aria-labelledby="comunidad-titulo" className="bg-[#f1e4ee]">
      <Container className="flex flex-col items-center py-19 text-center max-[600px]:py-15">
        <span aria-hidden="true" className="text-[30px] text-[#a877a7]">
          ✧
        </span>
        <Eyebrow className="mt-2">Síguenos</Eyebrow>
        <h2
          id="comunidad-titulo"
          className={cn(
            serifClass,
            'mt-1.25 text-balance text-[clamp(34px,4.6vw,55px)] leading-[1.2]',
          )}
        >
          Inspírate con Sky Beauty
        </h2>
        <p className="mt-3 max-w-120 text-pretty text-xs leading-[1.95] text-[#6a5e63]">
          Mira las novedades de la tienda en nuestras redes oficiales.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-2.75">
          {socials.map((social) => (
            <Button key={social.label} asChild variant="outline" className="bg-paper/60">
              <a href={social.url} target="_blank" rel="noopener noreferrer">
                {social.label} <ArrowUpRight size={15} />
              </a>
            </Button>
          ))}
        </div>
      </Container>
    </section>
  );
}

/**
 * Botón flotante de WhatsApp. Abajo a la derecha y respetando el área segura del celular; en
 * celular solo muestra el ícono para no tapar el contenido.
 */
export function WhatsappFloat({ number }: { number: string }) {
  return (
    <a
      href={whatsappUrl(number)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chatear con la tienda en WhatsApp"
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 inline-flex h-13 items-center gap-2.5 rounded-full bg-mauve-dark pl-4.5 pr-5.5 text-xs font-semibold text-white shadow-[0_10px_30px_rgb(59_36_46/0.28)] transition-[background,transform] duration-200 hover:-translate-y-0.5 hover:bg-mauve-deep max-[600px]:right-4 max-[600px]:h-12 max-[600px]:w-12 max-[600px]:justify-center max-[600px]:px-0"
    >
      <MessageCircle size={21} aria-hidden="true" />
      <span className="max-[600px]:hidden">WhatsApp</span>
    </a>
  );
}
