import { validateEnv } from './env';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '4000',
  CORS_ORIGINS: 'http://localhost:3000, https://skybeauty.test',
  PUBLIC_SITE_URL: 'http://localhost:3000',
  LOG_LEVEL: 'info',
  TRUST_PROXY_HOPS: '1',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(48),
  TRACKING_TOKEN_SECRET: 'y'.repeat(48),
  INTERNAL_API_KEY: '',
  ADMIN_SESSION_TTL_MINUTES: '480',
  LOGIN_MAX_FAILED_ATTEMPTS: '5',
  LOGIN_LOCK_MINUTES: '15',
  ORDER_PENDING_TTL_HOURS: '48',
  ORDER_UNPAID_TTL_HOURS: '24',
  ORDER_PAYMENT_CLARIFICATION_HOURS: '8',
  UPLOADS_DIR: './uploads',
  MAX_IMAGE_SIZE_MB: '5',
  TEST_DATABASE_URL: '',
};

describe('validateEnv', () => {
  it('convierte y normaliza las variables válidas', () => {
    const env = validateEnv(validEnv);
    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://skybeauty.test']);
    expect(env.ORDER_UNPAID_TTL_HOURS).toBe(24);
    expect(env.TEST_DATABASE_URL).toBeUndefined();
  });

  it('exige la dirección pública de la tienda', () => {
    expect(() => validateEnv({ ...validEnv, PUBLIC_SITE_URL: undefined })).toThrow(
      'PUBLIC_SITE_URL',
    );
    expect(() => validateEnv({ ...validEnv, PUBLIC_SITE_URL: 'no-es-url' })).toThrow(
      'PUBLIC_SITE_URL',
    );
  });

  it('exige un secreto propio para los enlaces de seguimiento', () => {
    expect(() => validateEnv({ ...validEnv, TRACKING_TOKEN_SECRET: undefined })).toThrow(
      'TRACKING_TOKEN_SECRET',
    );
  });

  it('exige la clave interna solo en producción', () => {
    expect(validateEnv(validEnv).INTERNAL_API_KEY).toBeUndefined();
    expect(() => validateEnv({ ...validEnv, NODE_ENV: 'production' })).toThrow('INTERNAL_API_KEY');
    expect(
      validateEnv({ ...validEnv, NODE_ENV: 'production', INTERNAL_API_KEY: 'k'.repeat(40) })
        .INTERNAL_API_KEY,
    ).toBe('k'.repeat(40));
  });

  it('rechaza un JWT_SECRET corto', () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: 'corto' })).toThrow('JWT_SECRET');
  });

  it('exige los plazos de cancelación', () => {
    expect(() =>
      validateEnv({ ...validEnv, ORDER_PAYMENT_CLARIFICATION_HOURS: undefined }),
    ).toThrow('ORDER_PAYMENT_CLARIFICATION_HOURS');
  });

  it('exige la carpeta de las imágenes', () => {
    expect(() => validateEnv({ ...validEnv, UPLOADS_DIR: '' })).toThrow('UPLOADS_DIR');
  });
});
