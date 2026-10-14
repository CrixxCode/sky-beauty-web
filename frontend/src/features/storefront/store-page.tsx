import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { RichText } from '@/components/content/rich-text';
import { StorePageHeading } from '@/features/storefront/catalog-ui';
import { fetchPublicApi, fetchPublicApiOptional } from '@/lib/api.server';
import { STORE_PAGE_LINKS, type StorePageSlug } from '@/types/store';

interface StorePage {
  slug: StorePageSlug;
  title: string;
  text: string;
}

const fetchPage = (slug: StorePageSlug) => fetchPublicApi<StorePage>(`/store/content/${slug}`);
const titleOf = (slug: StorePageSlug) =>
  STORE_PAGE_LINKS.find((page) => page.slug === slug)?.title ?? '';

/** Metadatos de una página de texto; mientras no tenga texto publicado no se indexa. */
export async function storePageMetadata(slug: StorePageSlug): Promise<Metadata> {
  const page = await fetchPublicApiOptional<StorePage>(`/store/content/${slug}`);
  return page
    ? { title: page.title }
    : { title: titleOf(slug), robots: { index: false, follow: false } };
}

/**
 * Página de texto de la tienda (términos, datos personales, cambios y garantías, envíos). El texto
 * lo escribe la propietaria en el panel. Mientras no haya texto aprobado, la página solo avisa que
 * la información estará disponible pronto (los borradores no se publican).
 */
export async function StoreTextPage({ slug }: { slug: StorePageSlug }) {
  const page = await fetchPage(slug);

  return (
    <Container className="min-h-[60vh] py-11.25">
      <StorePageHeading eyebrow="Información" title={page?.title ?? titleOf(slug)} />
      <article className="max-w-190">
        {page ? (
          <RichText source={page.text} />
        ) : (
          <p className="text-xs leading-[2] text-[#6a5e66]">
            Esta información estará disponible pronto.
          </p>
        )}
      </article>
    </Container>
  );
}
