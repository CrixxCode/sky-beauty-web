'use client';

import { ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eyebrow, serifClass } from '@/components/ui/typography';
import { formatCOP } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PublicBrand, PublicCategory, PublicProduct, PublicVariant } from '@/types/catalog';
import { isSoldOut, ProductPhoto, productPrice } from './catalog-ui';

function variantPrice(product: PublicProduct, variant: PublicVariant): number {
  return variant.price ?? product.basePrice;
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
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId) ?? firstAvailable;
  const variantImages = selectedVariant?.images ?? [];
  const gallery = variantImages.length > 0 ? variantImages : product.images;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = gallery[activeIndex] ?? gallery[0];
  const soldOut = isSoldOut(product);
  const selectedSoldOut = !selectedVariant || selectedVariant.stock <= 0;

  return (
    <div className="pt-7">
      <nav className="mb-7.25 flex flex-wrap gap-2.75 text-[10px] text-[#9c8d95]">
        <Link href="/">Inicio</Link>
        <span>/</span>
        <Link href="/productos">Productos</Link>
        {category && (
          <>
            <span>/</span>
            <Link href={`/productos?categoria=${category.id}`}>{category.name}</Link>
          </>
        )}
        <span>/</span>
        <span>{product.name}</span>
      </nav>

      <div className="grid grid-cols-[51%_1fr] gap-18.75 max-[850px]:gap-10 max-[600px]:grid-cols-1 max-[600px]:gap-5">
        <div>
          <div className="relative h-147.5 bg-[#f6f1f3] max-[850px]:h-127.5 max-[600px]:h-102.5">
            <ProductPhoto src={activeImage?.url ?? activeImage?.thumbnailUrl ?? null} alt={activeImage?.alt || product.name} />
            {soldOut && (
              <span className="absolute left-4.75 top-4.75 bg-white px-3.25 py-2.25 text-[11px] text-[#98566f]">
                Agotado
              </span>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="mt-3.25 flex gap-2.5 overflow-x-auto">
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
                  aria-label={`Ver imagen ${index + 1}`}
                >
                  <ProductPhoto src={image.thumbnailUrl} alt={image.alt || product.name} />
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3.25">
          <Eyebrow>
            {[brand?.name, category?.name, product.netContent].filter(Boolean).join(' · ')}
          </Eyebrow>
          <h1 className={cn(serifClass, 'mb-3.75 mt-2.5 text-[clamp(34px,4vw,57px)] leading-[1.23]')}>
            {product.name}
          </h1>
          <div className="flex items-center gap-2">
            {product.isFeatured && <Badge>Destacado</Badge>}
            {soldOut && <Badge variant="danger">Agotado</Badge>}
          </div>
          <div className="my-5 flex items-baseline gap-4 border-b border-[#ebe1e5] pb-5">
            <strong className="text-[27px] text-[#694368]">
              {formatCOP(selectedVariant ? variantPrice(product, selectedVariant) : productPrice(product))}
            </strong>
          </div>
          <p className="py-2.5 text-xs leading-[2.15] text-[#796b75]">{product.description}</p>

          {variants.length > 0 && (
            <div className="pt-3.75">
              <strong className="text-[11px]">
                Variante: <span className="font-normal text-[#957b8d]">{selectedVariant?.name}</span>
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
                      variant.stock <= 0 && 'text-[#a0929b]',
                    )}
                    aria-pressed={selectedVariant?.id === variant.id}
                  >
                    {variant.colorHex && (
                      <span
                        className="h-4 w-4 rounded-full border border-black/20"
                        style={{ backgroundColor: variant.colorHex }}
                      />
                    )}
                    {variant.name}
                    {variant.stock <= 0 && <span className="text-[9px]">Agotado</span>}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <p className="text-[11px] text-[#766e71]">
            <span
              className={cn(
                'mr-1.75 inline-block h-1.75 w-1.75 rounded-full bg-[#75a587]',
                selectedSoldOut && 'bg-[#c2818e]',
              )}
            />
            {selectedSoldOut ? 'Esta variante no está disponible.' : 'Disponible.'}
          </p>
          <div className="mt-7 flex gap-6.75 border-y border-[#ece5e8] py-5.75 max-[600px]:flex-wrap">
            <span className="flex items-center gap-2 text-[10px] text-[#786a75]">
              <ShieldCheck size={17} className="text-[#a1769f]" />
              Compra sin cuenta
            </span>
            <span className="flex items-center gap-2 text-[10px] text-[#786a75]">
              <Truck size={17} className="text-[#a1769f]" />
              Envío según tu municipio
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
