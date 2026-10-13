import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { ProductDetail } from '@/features/storefront/product-detail';
import { fetchPublicApi } from '@/lib/api.server';
import type { PublicBrand, PublicCategory, PublicProduct } from '@/types/catalog';

type ProductoDetallePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductoDetallePage({ params }: ProductoDetallePageProps) {
  const { slug } = await params;
  const [product, categories, brands] = await Promise.all([
    fetchPublicApi<PublicProduct>(`/store/products/${encodeURIComponent(slug)}`),
    fetchPublicApi<PublicCategory[]>('/store/categories'),
    fetchPublicApi<PublicBrand[]>('/store/brands'),
  ]);

  if (!product) notFound();

  const category = (categories ?? [])
    .flatMap((item) => [item, ...item.children])
    .find((item) => item.id === product.categoryId);
  const brand = (brands ?? []).find((item) => item.id === product.brandId);

  return (
    <Container className="pb-20 max-[600px]:pb-16.25">
      <ProductDetail product={product} category={category} brand={brand} />
    </Container>
  );
}
