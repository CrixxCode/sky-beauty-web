import { z } from 'zod';

/** Convierte cadenas vacías en undefined para que los campos opcionales del .env funcionen. */
const optionalUrl = z.preprocess((v) => (v === '' ? undefined : v), z.url().optional());
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().min(0);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: positiveInt.default(4000),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((v) =>
      v
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY_HOPS: nonNegativeInt.default(0),

  DATABASE_URL: z.url(),
  TEST_DATABASE_URL: optionalUrl,

  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  ADMIN_SESSION_TTL_MINUTES: positiveInt,
  LOGIN_MAX_FAILED_ATTEMPTS: positiveInt,
  LOGIN_LOCK_MINUTES: positiveInt,

  // Plazos de cancelación automática (ver Context/decisiones.md). 0 = desactivado.
  ORDER_PENDING_TTL_HOURS: nonNegativeInt,
  ORDER_UNPAID_TTL_HOURS: nonNegativeInt,
  ORDER_PAYMENT_CLARIFICATION_HOURS: nonNegativeInt,

  // Imágenes: se guardan en el disco del servidor (en producción, un volumen de Railway).
  // El proyecto no usa servicios de almacenamiento de pago (ver Context/decisiones.md).
  UPLOADS_DIR: z.string().min(1),
  PUBLIC_UPLOADS_BASE_URL: z.url(),
  MAX_IMAGE_SIZE_MB: z.coerce.number().positive(),
});

export type Env = z.infer<typeof envSchema>;

/** Valida las variables de entorno al arrancar. Detiene la aplicación con un mensaje claro si alguna es inválida. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${details}`);
  }
  return result.data;
}
