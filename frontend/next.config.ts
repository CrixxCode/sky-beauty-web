import type { NextConfig } from 'next';

// En pruebas (Jest) la configuración se carga antes que los archivos .env y no se usan rewrites.
const isTest = process.env.NODE_ENV === 'test';
const apiInternalUrl = process.env.API_INTERNAL_URL ?? '';
if (!apiInternalUrl && !isTest) {
  throw new Error('API_INTERNAL_URL no está definida (ver frontend/.env.example).');
}

const nextConfig: NextConfig = {
  // Las pruebas de punta a punta compilan en una carpeta aparte para no interferir con `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // El navegador llama siempre a /api/v1 en el mismo dominio; Next.js lo reenvía al backend.
  // Así no hay CORS en el navegador y la URL interna del backend nunca se expone.
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiInternalUrl.replace(/\/$/, '')}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
