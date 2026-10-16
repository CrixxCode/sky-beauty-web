import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoggerModule } from 'nestjs-pino';
import { type Env, validateEnv } from './config/env';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LocationsModule } from './modules/locations/locations.module';
import { NoticesModule } from './modules/notices/notices.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentMethodsModule } from './modules/payment-methods/payment-methods.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ShippingModule } from './modules/shipping/shipping.module';
import { StoreSettingsModule } from './modules/store-settings/store-settings.module';
import { TestimonialsModule } from './modules/testimonials/testimonials.module';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter';
import { RequestBodyInterceptor } from './shared/http/request-body.interceptor';
import { validationExceptionFactory } from './shared/http/validation-messages';
import { PrismaModule } from './shared/prisma/prisma.module';
import { isInternalRequest } from './shared/security/internal-request';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          transport:
            config.get('NODE_ENV', { infer: true }) === 'development'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-internal-api-key"]',
            'res.headers["set-cookie"]',
          ],
          autoLogging: { ignore: (req) => req.url?.endsWith('/health') ?? false },
        },
      }),
    }),
    // Límite general de peticiones por IP. Los endpoints sensibles (p. ej. inicio de sesión)
    // definen límites más estrictos en su propio módulo. Se desactiva en las pruebas automáticas y
    // para el servidor de Next.js: todas sus peticiones (las páginas que arma para cada visitante)
    // llegan desde la misma IP y agotarían el límite entre todos los clientes.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        skipIf: (context) =>
          config.get('NODE_ENV', { infer: true }) === 'test' ||
          isInternalRequest(
            context.switchToHttp().getRequest<Request>(),
            config.get('INTERNAL_API_KEY', { infer: true }),
          ),
      }),
    }),
    // Tareas programadas: cancelaciones automáticas y avisos (módulo 11).
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AdminUsersModule,
    StoreSettingsModule,
    PaymentMethodsModule,
    LocationsModule,
    CatalogModule,
    InventoryModule,
    PromotionsModule,
    ShippingModule,
    OrdersModule,
    NoticesModule,
    ReportsModule,
    DashboardModule,
    TestimonialsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestBodyInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: validationExceptionFactory,
      }),
    },
  ],
})
export class AppModule {}
