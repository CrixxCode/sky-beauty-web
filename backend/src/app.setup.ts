import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { resolve } from 'node:path';
import { Logger } from 'nestjs-pino';
import type { Env } from './config/env';
import { SESSION_COOKIE } from './modules/auth/auth.types';
import { UPLOADS_PATH } from './shared/uploads';

/** Prefijo de todas las rutas de la API. El frontend las consume a través de su proxy en /api/v1. */
export const API_PREFIX = 'api/v1';

/**
 * Configuración HTTP común de la aplicación. La usan main.ts y las pruebas de integración,
 * para que ambos ejecuten exactamente la misma configuración.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }), credentials: true });
  app.useStaticAssets(resolve(config.get('UPLOADS_DIR', { infer: true })), {
    prefix: UPLOADS_PATH,
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Sky Beauty API')
        .setVersion('1')
        .addCookieAuth(SESSION_COOKIE)
        .build(),
    );
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
  }
}
