import type { NextConfig } from 'next';

// En pruebas (Jest) la configuración se carga antes que los archivos .env y no se usan rewrites.
const isTest = process.env.NODE_ENV === 'test';
const apiInternalUrl = process.env.API_INTERNAL_URL ?? '';
if (!apiInternalUrl && !isTest) {
  throw new Error('API_INTERNAL_URL no está definida (ver frontend/.env.example).');
}

const isProduction = process.env.NODE_ENV === 'production';

/** Encabezados de seguridad de todas las páginas (el backend pone los suyos con helmet). */
const securityHeaders = [
  // Ninguna página (en especial el panel) se puede mostrar dentro de otro sitio.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Solo en producción, que se sirve siempre por HTTPS.
  ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
];

const nextConfig: NextConfig = {
  // Playwright usa next start con una carpeta propia; la imagen usa el servidor standalone.
  output: process.env.NEXT_DIST_DIR ? undefined : 'standalone',
  // Las pruebas de punta a punta compilan en una carpeta aparte para no interferir con `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // El navegador llama siempre a /api/v1 en el mismo dominio; Next.js lo reenvía al backend.
  // Así no hay CORS en el navegador y la URL interna del backend nunca se expone.
  // Las fotos de los productos también: se sirven desde el dominio de la tienda.
  async rewrites() {
    const api = apiInternalUrl.replace(/\/$/, '');
    return [
      { source: '/api/v1/:path*', destination: `${api}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${api}/uploads/:path*` },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
