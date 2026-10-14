'use client';

import { ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Eyebrow, serifClass } from '@/components/ui/typography';
import { AddToCartControls } from '@/features/cart/add-to-cart-controls';
import { FavoriteButton } from '@/features/favorites/favorite-button';
import { formatCOP } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicBrand, PublicCategory, PublicProduct, PublicVariant } from '@/types/catalog';
import { discountPercent, isSoldOut, ProductPhoto } from './catalog-ui';

function variantPrice(product: PublicProduct, variant: PublicVariant | null): number {
  return variant?.finalPrice ?? product.finalPriceFrom;
}

function variantRegularPrice(product: PublicProduct, variant: PublicVariant | null): number {
  return variant?.regularPrice ?? product.regularPriceFrom;
}

export function ProductDetail({
  product,
  brand,
  category,
}: {
  product: PublicProduct;
  brand?: PublicBrand;
  category?: PublicCategory;
}) {
  const variants = product.variants.filter((variant) => variant.isActive);
  const firstAvailable = variants.find((variant) => variant.stock > 0) ?? variants[0] ?? null;
  const [selectedVariantId, setSelectedVariantId] = useState(firstAvailable?.id ?? '');
  const selectedVariant =
    variants.find((variant) => variant.id === selectedVariantId) ?? firstAvailable;
  const variantImages = selectedVariant?.images ?? [];
  const gallery = variantImages.length > 0 ? variantImages : product.images;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = gallery[activeIndex] ?? gallery[0];
  const soldOut = isSoldOut(product);
  const finalPrice = variantPrice(product, selectedVariant);
  const regularPrice = variantRegularPrice(product, selectedVariant);
  const percent = discountPercent(regularPrice, finalPrice);
  const selectedSoldOut = !selectedVariant || selectedVariant.stock <= 0;
  const eyebrow = [brand?.name, category?.name, product.netContent].filter(Boolean).join(' · ');

  return (
    <div className="pt-7">
      <Breadcrumb className="mb-7.25">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Inicio</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/productos">Productos</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {category && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/productos?categoria=${category.id}`}>{category.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid grid-cols-[51%_1fr] gap-18.75 max-[850px]:gap-10 max-[600px]:grid-cols-1 max-[600px]:gap-5">
        <div>
          <div className="relative h-147.5 bg-[#f6f1f3] max-[850px]:h-127.5 max-[600px]:h-102.5">
            <ProductPhoto
              src={activeImage?.url ?? activeImage?.thumbnailUrl ?? null}
              alt={activeImage?.alt || product.name}
              priority
              size={1600}
            />
            {/* "Agotado" ya se indica junto al nombre; aquí solo el descuento. */}
            {percent > 0 && (
              <span className="absolute left-4.75 top-4.75 bg-white px-3.25 py-2.25 text-xs text-[#98566f]">
                −{percent}%
              </span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3.25 flex gap-2.5 overflow-x-auto overscroll-x-contain">
              {gallery.map((image, index) => (
                <Button
                  key={image.id}
                  variant="ghost"
                  size="icon"
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    'h-20.75 w-20.75 shrink-0 rounded-none border-2 border-transparent bg-[#f7f2f5] p-0 enabled:hover:translate-y-0 max-[600px]:h-17 max-[600px]:w-17',
                    activeIndex === index && 'border-[#9b6a98]',
                  )}
                  aria-label={`Ver imagen ${index + 1} de ${gallery.length}`}
                  aria-pressed={activeIndex === index}
                >
                  <ProductPhoto src={image.thumbnailUrl} alt="" />
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3.25">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1
            className={cn(
              serifClass,
              'mb-3.75 mt-2.5 text-balance wrap-break-word text-[clamp(32px,4vw,57px)] leading-[1.23]',
            )}
          >
            {product.name}
          </h1>
          <div className="flex items-center gap-2">
            {product.isFeatured && <Badge>Destacado</Badge>}
            {soldOut && <Badge variant="danger">Agotado</Badge>}
          </div>
          <div className="my-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[#ebe1e5] pb-5 tabular-nums">
            <strong className="text-[27px] text-[#694368]">{formatCOP(finalPrice)}</strong>
            {percent > 0 && (
              <>
                <del className="text-sm text-[#6f6669]">{formatCOP(regularPrice)}</del>
                <span className="text-xs text-[#94526c]">
                  Ahorras {formatCOP(regularPrice - finalPrice)}
                </span>
              </>
            )}
          </div>
          <p className="whitespace-pre-line py-2.5 text-xs leading-[2.15] text-[#6a5e66] wrap-break-word">
            {product.description}
          </p>

          {variants.length > 0 && (
            <div className="pt-3.75">
              <strong className="text-xs">
                Variante:{' '}
                <span className="font-normal text-[#776271]">{selectedVariant?.name}</span>
              </strong>
              <div className="my-4.25 flex flex-wrap gap-2.5">
                {variants.map((variant) => (
                  <Button
                    key={variant.id}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setActiveIndex(0);
                    }}
                    className={cn(
                      'rounded-none border-[#ddd1dc] bg-white px-3 font-normal text-[#493a45] enabled:hover:translate-y-0',
                      selectedVariant?.id === variant.id && 'border-[#765276] bg-[#f5edf4]',
                      variant.stock <= 0 && 'text-[#70666c]',
                    )}
                    aria-pressed={selectedVariant?.id === variant.id}
                  >
                    {variant.colorHex && (
                      <span
                        aria-hidden="true"
                        className="h-4 w-4 rounded-full border border-black/20"
                        style={{ backgroundColor: variant.colorHex }}
                      />
                    )}
                    {variant.name}
                    {variant.stock <= 0 && <span className="text-xs">· Agotado</span>}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <p role="status" className="text-xs text-[#6a5e65]">
            <span
              aria-hidden="true"
              className={cn(
                'mr-1.75 inline-block h-1.75 w-1.75 rounded-full bg-[#75a587]',
                selectedSoldOut && 'bg-[#c2818e]',
              )}
            />
            {selectedSoldOut ? 'Esta variante no está disponible.' : 'Disponible.'}
          </p>
          {/* La clave reinicia la cantidad elegida al cambiar de variante. */}
          <AddToCartControls key={selectedVariant?.id ?? 'none'} variant={selectedVariant} />
          <FavoriteButton
            variant="outline"
            productId={product.id}
            productName={product.name}
            className="-mt-4 max-[600px]:w-full"
          />
          <div className="mt-7 flex gap-6.75 border-y border-[#ece5e8] py-5.75 max-[600px]:flex-wrap">
            <span className="flex items-center gap-2 text-xs text-[#6a5e65]">
              <ShieldCheck size={17} className="text-[#7f5d7e]" />
              Compra sin cuenta
            </span>
            <span className="flex items-center gap-2 text-xs text-[#6a5e65]">
              <Truck size={17} className="text-[#7f5d7e]" />
              Envío según tu municipio
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
