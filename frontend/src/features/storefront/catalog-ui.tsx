import { ArrowRight, Search, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eyebrow, serifClass } from '@/components/ui/typography';
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

export function ProductPhoto({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-3 bg-[#f2e8ee] text-[#99759b]',
          className,
        )}
        role="img"
        aria-label={`Imagen pendiente: ${alt}`}
      >
        <ShoppingBag size={30} strokeWidth={1.4} />
        <span className="text-[10px]">Foto pendiente</span>
      </div>
    );
  }

  return <img src={src} alt={alt} className={cn('h-full w-full object-cover', className)} />;
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
      <h1 className={cn(serifClass, 'mb-4 mt-2.5 text-[clamp(39px,5vw,64px)] leading-[1.2]')}>
        {title}
      </h1>
      {description && (
        <p className="max-w-165 text-xs leading-[1.95] text-[#74676c]">{description}</p>
      )}
    </div>
  );
}

export function ProductCard({
  product,
  brand,
  category,
}: {
  product: PublicProduct;
  brand?: PublicBrand;
  category?: PublicCategory;
}) {
  const soldOut = isSoldOut(product);
  const percent = discountPercent(productRegularPrice(product), productPrice(product));

  return (
    <article className="min-w-0">
      <Link
        href={`/producto/${product.slug}`}
        className="relative block h-75 overflow-hidden bg-[#f4f0ee] max-[850px]:h-85 max-[600px]:h-56.25 max-[380px]:h-45"
        aria-label={`Ver ${product.name}`}
      >
        <ProductPhoto src={productCover(product)} alt={product.name} />
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
      <div className="pt-3.75">
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[.105em] text-[#8e6d89]">
          {brand?.name ?? 'Marca'}{' '}
          {category ? (
            <span className="font-normal normal-case text-[#a79aa0]">· {category.name}</span>
          ) : null}
        </p>
        <Link href={`/producto/${product.slug}`}>
          <h3 className="min-h-9.5 text-xs font-medium leading-[1.65] text-[#3f333c] max-[600px]:min-h-11 max-[600px]:text-[11px]">
            {product.name}
          </h3>
        </Link>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <strong className="text-xs font-semibold max-[600px]:text-[11px]">
              {formatCOP(productPrice(product))}
            </strong>
            {percent > 0 && (
              <del className="mt-0.75 block text-[10px] text-[#a7999d]">
                {formatCOP(productRegularPrice(product))}
              </del>
            )}
          </div>
          <Link
            href={`/producto/${product.slug}`}
            className="grid h-8.5 w-8.5 place-items-center bg-[#f5edf4] text-[#794779] hover:bg-[#d8bfda] max-[600px]:h-7.5 max-[600px]:w-7.5"
            aria-label={`Ver ${product.name}`}
          >
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  brands,
  categories,
}: {
  products: PublicProduct[];
  brands: PublicBrand[];
  categories: PublicCategory[];
}) {
  const brandMap = new Map(brands.map((brand) => [brand.id, brand]));
  const categoryMap = new Map(
    categories.flatMap((category) => [
      [category.id, category],
      ...category.children.map((child) => [child.id, child] as const),
    ]),
  );

  return (
    <div className="grid grid-cols-4 gap-x-5.5 gap-y-8.75 max-[850px]:grid-cols-2 max-[600px]:gap-x-2.75 max-[600px]:gap-y-6.5">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          brand={brandMap.get(product.brandId)}
          category={categoryMap.get(product.categoryId)}
        />
      ))}
    </div>
  );
}

export function EmptyCatalog() {
  return (
    <div className="mx-auto my-8.75 flex max-w-140 flex-col items-center bg-[#faf6f8] px-6 py-15 text-center">
      <div className="grid h-16.25 w-16.25 place-items-center rounded-full bg-[#eee0ed] text-[#96679b]">
        <Search />
      </div>
      <h2 className={cn(serifClass, 'mb-2.5 mt-4.75 text-[31px]')}>
        No hay productos para mostrar
      </h2>
      <p className="mb-6.5 max-w-96 text-xs leading-[1.85] text-[#88777e]">
        Prueba con otra búsqueda o explora el catálogo completo.
      </p>
      <Button asChild>
        <Link href="/productos">
          Ver catálogo <ArrowRight size={16} />
        </Link>
      </Button>
    </div>
  );
}

export function StoreSearch({
  defaultValue,
  compact = false,
}: {
  defaultValue?: string;
  compact?: boolean;
}) {
  return (
    <form
      action="/productos"
      className={cn(
        'flex items-center gap-2.5 border border-[#f0eae9] bg-[#f8f5f3] px-4.25 text-[#8f8387]',
        compact ? 'h-10.75 w-full' : 'h-11.25 flex-1 max-w-127.5',
      )}
    >
      <Search size={18} />
      <Input
        name="q"
        defaultValue={defaultValue}
        placeholder="Buscar productos"
        aria-label="Buscar productos"
        className="min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 focus:border-0"
      />
      <Button type="submit" variant="secondary" size="sm" className="min-h-7.75 px-3.5 text-[10px]">
        Buscar
      </Button>
    </form>
  );
}

export function CatalogFilters({
  categories,
  brands,
  activeCategory,
  activeBrand,
  query,
}: {
  categories: PublicCategory[];
  brands: PublicBrand[];
  activeCategory?: string;
  activeBrand?: string;
  query?: string;
}) {
  return (
    <aside className="flex flex-col gap-6 max-[600px]:hidden">
      <div className="border-b border-[#ece4e7] pb-5.5">
        <h3 className="mb-3.5 text-xs font-semibold">Buscar</h3>
        <StoreSearch defaultValue={query} compact />
      </div>
      <FilterGroup title="Categorías">
        <FilterLink href="/productos" active={!activeCategory}>
          Todas las categorías
        </FilterLink>
        {categories.map((category) => (
          <div key={category.id}>
            <FilterLink
              href={`/productos?categoria=${category.id}`}
              active={activeCategory === category.id}
            >
              {category.name}
            </FilterLink>
            {category.children.map((child) => (
              <FilterLink
                key={child.id}
                href={`/productos?categoria=${child.id}`}
                active={activeCategory === child.id}
                className="pl-3"
              >
                {child.name}
              </FilterLink>
            ))}
          </div>
        ))}
      </FilterGroup>
      <FilterGroup title="Marcas">
        {brands.map((brand) => (
          <FilterLink
            key={brand.id}
            href={`/productos?marca=${brand.id}`}
            active={activeBrand === brand.id}
          >
            {brand.name}
          </FilterLink>
        ))}
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[#ece4e7] pb-5.5">
      <h3 className="mb-3.5 text-xs font-semibold">{title}</h3>
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
      className={cn(
        'flex w-full items-center justify-between py-1.75 text-left text-[11px] text-[#786c73]',
        active && 'font-semibold text-[#7e4a7a]',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function MobileFilterLinks({
  categories,
  brands,
}: {
  categories: PublicCategory[];
  brands: PublicBrand[];
}) {
  return (
    <div className="mb-5 hidden gap-2 overflow-x-auto max-[600px]:flex">
      <Link
        className="shrink-0 bg-[#f3e8f1] px-2.5 py-1.75 text-[10px] text-[#70416e]"
        href="/productos"
      >
        Todo
      </Link>
      {categories
        .flatMap((category) => [category, ...category.children])
        .map((category) => (
          <Link
            className="shrink-0 bg-[#f3e8f1] px-2.5 py-1.75 text-[10px] text-[#70416e]"
            key={category.id}
            href={`/productos?categoria=${category.id}`}
          >
            {category.name}
          </Link>
        ))}
      {brands.map((brand) => (
        <Link
          className="shrink-0 bg-[#f3e8f1] px-2.5 py-1.75 text-[10px] text-[#70416e]"
          key={brand.id}
          href={`/productos?marca=${brand.id}`}
        >
          {brand.name}
        </Link>
      ))}
    </div>
  );
}
