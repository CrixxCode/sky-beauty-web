import type { MetadataRoute } from 'next';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Los buscadores no indexan el panel, el carrito, el checkout ni las páginas privadas del pedido. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/carrito', '/checkout', '/pedido', '/seguimiento', '/rastrear', '/api'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
