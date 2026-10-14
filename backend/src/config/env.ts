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
  // Dirección pública de la tienda (frontend), para armar enlaces que se comparten con el
  // cliente, como el de seguimiento del pedido.
  PUBLIC_SITE_URL: z.url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY_HOPS: nonNegativeInt.default(0),

  DATABASE_URL: z.url(),
  TEST_DATABASE_URL: optionalUrl,

  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  // Secreto de los enlaces de seguimiento, separado de JWT_SECRET: cambiar el de las sesiones no
  // debe romper los enlaces que los clientes ya recibieron por WhatsApp.
  TRACKING_TOKEN_SECRET: z
    .string()
    .min(32, 'TRACKING_TOKEN_SECRET debe tener al menos 32 caracteres'),
  // Clave con la que el servidor de Next.js se identifica ante la API. Sus peticiones no cuentan
  // para el límite por IP: todas llegan desde la misma IP, la del servidor de Next.js.
  INTERNAL_API_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(32, 'INTERNAL_API_KEY debe tener al menos 32 caracteres').optional(),
  ),
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
  MAX_IMAGE_SIZE_MB: z.coerce.number().positive(),
});

export type Env = z.infer<typeof envSchema>;

/** Reglas que dependen de varias variables. */
const productionSchema = envSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && !env.INTERNAL_API_KEY) {
    ctx.addIssue({
      code: 'custom',
      path: ['INTERNAL_API_KEY'],
      message: 'es obligatoria en producción',
    });
  }
});

/** Valida las variables de entorno al arrancar. Detiene la aplicación con un mensaje claro si alguna es inválida. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = productionSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${details}`);
  }
  return result.data;
}
