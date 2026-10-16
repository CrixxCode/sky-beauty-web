import { ArrowRight, Search, ShoppingBag, X } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eyebrow, serifClass } from '@/components/ui/typography';
import { QuickAddButton } from '@/features/cart/quick-add-button';
import { FavoriteButton } from '@/features/favorites/favorite-button';
import { formatCOP } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicBrand, PublicCategory, PublicProduct } from '@/types/catalog';

export function productPrice(product: PublicProduct): number {
  return product.finalPriceFrom;
}

/** Precio regular de la misma variante que da el precio "desde" (lo calcula la API). */
export function productRegularPrice(product: PublicProduct): number {
  return product.regularPriceFrom;
}

/** Porcentaje de descuento a mostrar, redondeado; 0 si no hay descuento. */
export function discountPercent(regularPrice: number, finalPrice: number): number {
  if (regularPrice <= 0 || finalPrice >= regularPrice) return 0;
  return Math.max(1, Math.round(((regularPrice - finalPrice) / regularPrice) * 100));
}

export function isSoldOut(product: PublicProduct): boolean {
  return product.variants
    .filter((variant) => variant.isActive)
    .every((variant) => variant.stock <= 0);
}

/** Filtros del catálogo tal como viajan en la URL de /productos. */
export interface CatalogParams {
  categoria?: string;
  marca?: string;
  q?: string;
  /** "1": solo productos con una promoción vigente. */
  ofertas?: string;
}

/**
 * Enlace al catálogo que conserva los filtros actuales y aplica los cambios indicados
 * (`undefined` quita el filtro). Cambiar un filtro vuelve a la primera página.
 */
export function catalogHref(params: CatalogParams, changes: CatalogParams = {}, page = 1): string {
  const next = { ...params, ...changes };
  const search = new URLSearchParams();
  if (next.categoria) search.set('categoria', next.categoria);
  if (next.marca) search.set('marca', next.marca);
  if (next.q) search.set('q', next.q);
  if (next.ofertas) search.set('ofertas', next.ofertas);
  if (page > 1) search.set('pagina', String(page));
  const query = search.toString();
  return query ? `/productos?${query}` : '/productos';
}

/** Categorías y subcategorías en una sola lista, en el orden del menú. */
export function flattenCategories(categories: PublicCategory[]): PublicCategory[] {
  return categories.flatMap((category) => [category, ...category.children]);
}

/**
 * Foto de portada del producto. `thumbnail` (420 px, recortada al cuadrado) sirve para tarjetas;
 * `full` (hasta 1600 px) para contenedores grandes, donde la miniatura se vería borrosa.
 */
export function productCover(
  product: PublicProduct,
  size: 'thumbnail' | 'full' = 'thumbnail',
): string | null {
  const image =
    product.images[0] ??
    product.variants.find((variant) => variant.images.length > 0)?.images[0] ??
    null;
  if (!image) return null;
  return size === 'full' ? image.url : image.thumbnailUrl;
}

/**
 * Foto que llena su contenedor. Por defecto se carga al acercarse a la pantalla; la foto principal
 * de una página usa `priority` para cargarse primero.
 */
export function ProductPhoto({
  src,
  alt,
  className,
  priority = false,
  eager = false,
  size = 420,
  onLoad,
}: {
  src: string | null;
  alt: string;
  className?: string;
  /** Foto principal visible al cargar la página: se pide antes que las demás. */
  priority?: boolean;
  /** Visible al cargar la página, sin ser la principal: se carga sin esperar al desplazamiento. */
  eager?: boolean;
  /** Ancho y alto de referencia (las miniaturas son cuadradas de 420 px). */
  size?: number;
  onLoad?: () => void;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-3 bg-[#f2e8ee] text-[#7c5f7e]',
          className,
        )}
        role="img"
        aria-label={`Imagen pendiente: ${alt}`}
      >
        <ShoppingBag size={30} strokeWidth={1.4} />
        <span className="text-xs">Foto pendiente</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={priority || eager ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      onLoad={onLoad}
      className={cn('h-full w-full object-cover', className)}
    />
  );
}

export function StorePageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-11.75 max-w-200 max-[600px]:mb-6.75">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1
        className={cn(
          serifClass,
          'mb-4 mt-2.5 text-balance wrap-break-word text-[clamp(36px,5vw,64px)] leading-[1.2]',
        )}
      >
        {title}
      </h1>
      {description && (
        <p className="max-w-165 text-pretty text-xs leading-[1.95] text-[#6a5e63]">{description}</p>
      )}
    </div>
  );
}

/** Muestras de color de las variantes que lo tienen (máximo `limit`, con "+N" si hay más). */
function VariantSwatches({ product, limit = 5 }: { product: PublicProduct; limit?: number }) {
  const colored = product.variants.filter((variant) => variant.colorHex);
  if (colored.length < 2) return null;
  const rest = colored.length - limit;

  return (
    // `relative`: el texto para lectores de pantalla (posición absoluta) queda dentro de la fila
    // deslizable que contiene la tarjeta y no ensancha la página.
    <div className="relative mt-2 flex items-center gap-1.5">
      <span className="sr-only">Disponible en {colored.length} tonos</span>
      {colored.slice(0, limit).map((variant) => (
        <span
          key={variant.id}
          aria-hidden="true"
          title={variant.name}
          className="size-3.5 shrink-0 rounded-full border border-black/10 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.6)]"
          style={{ backgroundColor: variant.colorHex ?? undefined }}
        />
      ))}
      {rest > 0 && (
        <span aria-hidden="true" className="text-xs tabular-nums text-[#6e666a]">
          +{rest}
        </span>
      )}
    </div>
  );
}

/**
 * Tarjeta de producto de la tienda (replica .product-card del prototipo): foto con etiquetas y
 * favorito, marca y categoría, tonos, precio y "+" para agregar a la bolsa los productos de una
 * sola variante (con varias, la flecha lleva al detalle para elegir).
 */
export function ProductCard({
  product,
  brand,
  category,
  eager = false,
}: {
  product: PublicProduct;
  brand?: PublicBrand;
  category?: PublicCategory;
  eager?: boolean;
}) {
  const soldOut = isSoldOut(product);
  const percent = discountPercent(productRegularPrice(product), productPrice(product));
  const href = `/producto/${product.slug}`;
  const singleVariant = product.variants.length === 1 ? product.variants[0] : null;

  return (
    <article className="group relative min-w-0">
      <div className="relative">
        {/* La foto y la flecha repiten el enlace del nombre: quedan fuera del orden del teclado
            y del lector de pantalla para que cada producto sea una sola parada. */}
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="relative block h-75 overflow-hidden bg-[#f4f0ee] max-[850px]:h-85 max-[600px]:h-56.25 max-[380px]:h-45"
        >
          <ProductPhoto
            src={productCover(product)}
            alt=""
            eager={eager}
            className="transition-transform duration-500 ease-out-strong motion-safe:group-hover:scale-[1.045]"
          />
          <div className="absolute left-3.25 top-3.25 flex flex-col gap-1.25">
            {percent > 0 ? (
              <Badge variant="sale">−{percent}%</Badge>
            ) : (
              product.hasDiscount && <Badge variant="sale">Promoción</Badge>
            )}
            {product.isFeatured && <Badge>Destacado</Badge>}
            {soldOut && <Badge variant="danger">Agotado</Badge>}
          </div>
        </Link>
        <FavoriteButton
          productId={product.id}
          productName={product.name}
          className="absolute right-2.5 top-2.5"
        />
      </div>
      <div className="pt-3.75">
        {(brand || category) && (
          <p className="mb-1.5 truncate text-xs font-bold uppercase tracking-[.105em] text-[#7c5f77]">
            {brand?.name}
            {category && (
              <span className="font-normal normal-case text-[#6e666a]">
                {brand ? ' · ' : ''}
                {category.name}
              </span>
            )}
          </p>
        )}
        <h3 className="text-xs font-medium leading-[1.65] text-[#3f333c] max-[600px]:text-[13px]">
          {/* La altura mínima va en el enlace: toda la zona del título abre el producto. */}
          <Link
            href={href}
            className="line-clamp-2 min-h-9.5 wrap-break-word hover:text-[#70436f] max-[600px]:min-h-11"
          >
            {product.name}
          </Link>
        </h3>
        <VariantSwatches product={product} />
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0 tabular-nums">
            <strong className="text-xs font-semibold max-[600px]:text-[13px]">
              {formatCOP(productPrice(product))}
            </strong>
            {percent > 0 && (
              <del className="mt-0.75 block text-xs text-[#6e6568]">
                {formatCOP(productRegularPrice(product))}
              </del>
            )}
          </div>
          {singleVariant ? (
            <QuickAddButton
              productName={product.name}
              variantId={singleVariant.id}
              stock={singleVariant.stock}
              maxPerOrder={singleVariant.maxPerOrder}
            />
          ) : (
            <Link
              href={href}
              tabIndex={-1}
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center bg-[#f5edf4] text-[#794779] hover:bg-[#d8bfda]"
            >
              <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  brands,
  categories,
  eagerCount = 0,
}: {
  products: PublicProduct[];
  brands: PublicBrand[];
  categories: PublicCategory[];
  /** Cuántas tarjetas del principio se ven al cargar la página (sus fotos no esperan). */
  eagerCount?: number;
}) {
  const brandMap = new Map(brands.map((brand) => [brand.id, brand]));
  const categoryMap = new Map(
    flattenCategories(categories).map((category) => [category.id, category] as const),
  );

  return (
    <div className="grid grid-cols-4 gap-x-5.5 gap-y-8.75 max-[850px]:grid-cols-2 max-[600px]:gap-x-2.75 max-[600px]:gap-y-6.5">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          brand={brandMap.get(product.brandId)}
          category={categoryMap.get(product.categoryId)}
          eager={index < eagerCount}
        />
      ))}
    </div>
  );
}

export function EmptyCatalog({ filtered = false }: { filtered?: boolean }) {
  return (
    <div className="mx-auto my-8.75 flex max-w-140 flex-col items-center bg-[#faf6f8] px-6 py-15 text-center">
      <div className="grid h-16.25 w-16.25 place-items-center rounded-full bg-[#eee0ed] text-[#825a87]">
        <Search />
      </div>
      <h2 className={cn(serifClass, 'mb-2.5 mt-4.75 text-balance text-[31px]')}>
        No hay productos para mostrar
      </h2>
      <p className="mb-6.5 max-w-96 text-xs leading-[1.85] text-[#72646a]">
        {filtered
          ? 'Ningún producto coincide con estos filtros. Quita alguno o explora el catálogo completo.'
          : 'Aún no hay productos publicados. Vuelve pronto.'}
      </p>
      {filtered && (
        <Button asChild>
          <Link href="/productos">
            Ver todo el catálogo <ArrowRight size={16} />
          </Link>
        </Button>
      )}
    </div>
  );
}

/**
 * Buscador del catálogo. `keep` conserva la categoría y la marca elegidas (buscador de la barra
 * de filtros); sin `keep` la búsqueda empieza de cero (buscador del encabezado).
 */
export function StoreSearch({
  defaultValue,
  compact = false,
  keep,
}: {
  defaultValue?: string;
  compact?: boolean;
  keep?: Pick<CatalogParams, 'categoria' | 'marca' | 'ofertas'>;
}) {
  return (
    <form
      action="/productos"
      role="search"
      className={cn(
        'flex items-center gap-2.5 border border-[#f0eae9] bg-[#f8f5f3] px-4.25 text-[#706669] has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-mauve-dark',
        compact ? 'h-11.25 w-full' : 'h-11.25 max-w-127.5 flex-1',
      )}
    >
      <Search size={18} className="shrink-0" />
      {keep?.categoria && <input type="hidden" name="categoria" value={keep.categoria} />}
      {keep?.marca && <input type="hidden" name="marca" value={keep.marca} />}
      {keep?.ofertas && <input type="hidden" name="ofertas" value={keep.ofertas} />}
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Buscar productos…"
        aria-label="Buscar productos"
        enterKeyHint="search"
        autoComplete="off"
        className="min-h-0 min-w-0 flex-1 self-stretch border-0 bg-transparent p-0 focus:border-0 focus-visible:outline-none!"
      />
      <Button type="submit" variant="secondary" size="sm" className="min-h-8.5 px-3.5 text-xs">
        Buscar
      </Button>
    </form>
  );
}

/** Filtros del catálogo (barra lateral en escritorio y panel de filtros en celular). */
export function CatalogFilters({
  categories,
  brands,
  params,
  className,
}: {
  categories: PublicCategory[];
  brands: PublicBrand[];
  params: CatalogParams;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="border-b border-[#ece4e7] pb-5.5">
        <h2 className="mb-3.5 text-xs font-semibold">Buscar</h2>
        <StoreSearch
          key={params.q ?? ''}
          defaultValue={params.q}
          compact
          keep={{ categoria: params.categoria, marca: params.marca, ofertas: params.ofertas }}
        />
      </div>
      <FilterGroup title="Precio">
        <FilterLink href={catalogHref(params, { ofertas: undefined })} active={!params.ofertas}>
          Todos los precios
        </FilterLink>
        <FilterLink href={catalogHref(params, { ofertas: '1' })} active={params.ofertas === '1'}>
          Solo ofertas
        </FilterLink>
      </FilterGroup>
      {categories.length > 0 && (
        <FilterGroup title="Categorías">
          <FilterLink
            href={catalogHref(params, { categoria: undefined })}
            active={!params.categoria}
          >
            Todas las categorías
          </FilterLink>
          {categories.map((category) => (
            <div key={category.id}>
              <FilterLink
                href={catalogHref(params, { categoria: category.id })}
                active={params.categoria === category.id}
              >
                {category.name}
              </FilterLink>
              {category.children.map((child) => (
                <FilterLink
                  key={child.id}
                  href={catalogHref(params, { categoria: child.id })}
                  active={params.categoria === child.id}
                  className="pl-3"
                >
                  {child.name}
                </FilterLink>
              ))}
            </div>
          ))}
        </FilterGroup>
      )}
      {brands.length > 0 && (
        <FilterGroup title="Marcas">
          <FilterLink href={catalogHref(params, { marca: undefined })} active={!params.marca}>
            Todas las marcas
          </FilterLink>
          {brands.map((brand) => (
            <FilterLink
              key={brand.id}
              href={catalogHref(params, { marca: brand.id })}
              active={params.marca === brand.id}
            >
              {brand.name}
            </FilterLink>
          ))}
        </FilterGroup>
      )}
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#ece4e7] pb-5.5">
      <h2 className="mb-3.5 text-xs font-semibold">{title}</h2>
      <div>{children}</div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  className,
  children,
}: {
  href: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center justify-between py-1.75 text-left text-xs text-[#6a5e65] hover:text-[#5b365b] max-[600px]:min-h-11 max-[600px]:py-2.5 max-[600px]:text-sm',
        active && 'font-semibold text-[#7e4a7a]',
        className,
      )}
    >
      {children}
    </Link>
  );
}

const chipClass =
  'inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3.5 text-xs transition-colors';

/** Atajos de categoría en celular, con la elegida resaltada. */
export function MobileCategoryChips({
  categories,
  params,
}: {
  categories: PublicCategory[];
  params: CatalogParams;
}) {
  const all = flattenCategories(categories);
  if (all.length === 0) return null;
  const chip = (active: boolean) =>
    cn(
      chipClass,
      active
        ? 'bg-mauve-dark font-semibold text-white'
        : 'bg-[#f3e8f1] text-[#70416e] hover:bg-[#ebd9eb]',
    );

  return (
    <nav
      aria-label="Categorías"
      className="-mx-4.25 mb-5 hidden gap-2 overflow-x-auto overscroll-x-contain px-4.25 max-[600px]:flex"
    >
      <Link
        href={catalogHref(params, { categoria: undefined })}
        aria-current={!params.categoria ? 'page' : undefined}
        className={chip(!params.categoria)}
      >
        Todo
      </Link>
      {all.map((category) => (
        <Link
          key={category.id}
          href={catalogHref(params, { categoria: category.id })}
          aria-current={params.categoria === category.id ? 'page' : undefined}
          className={chip(params.categoria === category.id)}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}

/** Filtros aplicados, cada uno con su botón para quitarlo, y la opción de limpiarlos todos. */
export function ActiveFilters({
  params,
  categoryName,
  brandName,
}: {
  params: CatalogParams;
  categoryName?: string;
  brandName?: string;
}) {
  const filters = [
    params.categoria && {
      key: 'categoria' as const,
      label: categoryName ?? 'Categoría',
      remove: `Quitar la categoría ${categoryName ?? ''}`.trim(),
    },
    params.marca && {
      key: 'marca' as const,
      label: brandName ?? 'Marca',
      remove: `Quitar la marca ${brandName ?? ''}`.trim(),
    },
    params.ofertas && {
      key: 'ofertas' as const,
      label: 'En oferta',
      remove: 'Quitar el filtro de ofertas',
    },
    params.q && {
      key: 'q' as const,
      label: `“${params.q}”`,
      remove: `Quitar la búsqueda “${params.q}”`,
    },
  ].filter((filter): filter is { key: keyof CatalogParams; label: string; remove: string } =>
    Boolean(filter),
  );
  if (filters.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <Link
          key={filter.key}
          href={catalogHref(params, { [filter.key]: undefined })}
          aria-label={filter.remove}
          className={cn(
            chipClass,
            'max-w-full bg-[#f4ebf4] text-[#5d405b] hover:bg-[#ebd9eb]',
            // En celular la categoría ya se ve resaltada en los atajos de categoría.
            filter.key === 'categoria' && 'max-[600px]:hidden',
          )}
        >
          <span className="truncate">{filter.label}</span>
          <X size={14} className="shrink-0" />
        </Link>
      ))}
      {filters.length > 1 && (
        <Link
          href="/productos"
          className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-[#764b77] underline-offset-4 hover:underline"
        >
          Limpiar filtros
        </Link>
      )}
    </div>
  );
}
