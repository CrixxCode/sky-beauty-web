import { defineConfig, devices } from '@playwright/test';
import { BACKEND_DIR, E2E_BACKEND_PORT, E2E_FRONTEND_PORT, testDatabaseUrl } from './e2e/env';

const frontendUrl = `http://localhost:${E2E_FRONTEND_PORT}`;
const backendUrl = `http://localhost:${E2E_BACKEND_PORT}`;

/**
 * Pruebas de punta a punta contra versiones compiladas del backend y del frontend, en puertos
 * y carpetas propias (dist-e2e, .next-e2e) y contra la base de pruebas, para no interferir con
 * los servidores de desarrollo ni con sus datos.
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    locale: 'es-CO',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'] } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command:
        'npx tsc -p tsconfig.build.json --outDir dist-e2e --tsBuildInfoFile dist-e2e/.tsbuildinfo && node dist-e2e/main.js',
      cwd: BACKEND_DIR,
      url: `${backendUrl}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DATABASE_URL: testDatabaseUrl(),
        PORT: String(E2E_BACKEND_PORT),
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        CORS_ORIGINS: frontendUrl,
        PUBLIC_SITE_URL: frontendUrl,
        // Las fotos de las pruebas no se mezclan con las de desarrollo.
        UPLOADS_DIR: './uploads-e2e',
      },
    },
    {
      command: `npm run build && npx next start --port ${E2E_FRONTEND_PORT}`,
      url: frontendUrl,
      reuseExistingServer: false,
      timeout: 300_000,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        API_INTERNAL_URL: backendUrl,
        NEXT_PUBLIC_SITE_URL: frontendUrl,
      },
    },
  ],
});
