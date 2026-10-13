import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '@/components/layout/container';
import { RichText } from '@/components/content/rich-text';
import { StorePageHeading } from '@/features/storefront/catalog-ui';
import { fetchPublicApi } from '@/lib/api.server';
import type { StorePageSlug } from '@/types/store';

interface StorePage {
  slug: StorePageSlug;
  title: string;
  text: string;
}

const fetchPage = (slug: StorePageSlug) => fetchPublicApi<StorePage>(`/store/content/${slug}`);

/** Metadatos de una página de texto; sin texto publicado no se indexa. */
export async function storePageMetadata(slug: StorePageSlug): Promise<Metadata> {
  const page = await fetchPage(slug);
  return page ? { title: page.title } : { robots: { index: false } };
}

/**
 * Página de texto de la tienda (términos, datos personales, cambios y garantías, envíos). El texto
 * lo escribe la propietaria en el panel; mientras no haya texto aprobado, la página no existe.
 */
export async function StoreTextPage({ slug }: { slug: StorePageSlug }) {
  const page = await fetchPage(slug);
  if (!page) notFound();

  return (
    <Container className="min-h-[60vh] py-11.25">
      <StorePageHeading eyebrow="Información" title={page.title} />
      <article className="max-w-190">
        <RichText source={page.text} />
      </article>
    </Container>
  );
}
