import type { MetadataRoute } from 'next';
import { fetchPublicApi } from '@/lib/api.server';
import type { PaginatedPublicProducts } from '@/types/catalog';
import type { PublicStoreInfo } from '@/types/store';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const PAGE_SIZE = 100;

// Se genera en cada petición: refleja los productos y páginas publicados en ese momento.
export const dynamic = 'force-dynamic';

/** Mapa del sitio: inicio, catálogo, contacto, páginas legales publicadas y productos activos. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const info = await fetchPublicApi<PublicStoreInfo>('/store/info');
  const entries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/productos`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/contacto`, changeFrequency: 'monthly', priority: 0.4 },
    ...(info?.publishedPages ?? []).map((slug) => ({
      url: `${siteUrl}/${slug}`,
      changeFrequency: 'yearly' as const,
      priority: 0.2,
    })),
  ];

  for (let page = 1; ; page += 1) {
    const result = await fetchPublicApi<PaginatedPublicProducts>(
      `/store/products?limit=${PAGE_SIZE}&page=${page}`,
    );
    const items = result?.items ?? [];
    entries.push(
      ...items.map((product) => ({
        url: `${siteUrl}/producto/${product.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    );
    if (!result || page * PAGE_SIZE >= result.total || items.length === 0) break;
  }
  return entries;
}
