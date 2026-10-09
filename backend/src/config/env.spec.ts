import { validateEnv } from './env';

const validEnv = {
  NODE_ENV: 'development',
  PORT: '4000',
  CORS_ORIGINS: 'http://localhost:3000, https://skybeauty.test',
  LOG_LEVEL: 'info',
  TRUST_PROXY_HOPS: '1',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(48),
  ADMIN_SESSION_TTL_MINUTES: '480',
  LOGIN_MAX_FAILED_ATTEMPTS: '5',
  LOGIN_LOCK_MINUTES: '15',
  ORDER_PENDING_TTL_HOURS: '48',
  ORDER_UNPAID_TTL_HOURS: '24',
  ORDER_PAYMENT_CLARIFICATION_HOURS: '8',
  UPLOADS_DIR: './uploads',
  PUBLIC_UPLOADS_BASE_URL: 'http://localhost:4000/uploads',
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

  it('rechaza un JWT_SECRET corto', () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: 'corto' })).toThrow('JWT_SECRET');
  });

  it('exige los plazos de cancelación', () => {
    expect(() =>
      validateEnv({ ...validEnv, ORDER_PAYMENT_CLARIFICATION_HOURS: undefined }),
    ).toThrow('ORDER_PAYMENT_CLARIFICATION_HOURS');
  });

  it('exige la carpeta y la URL pública de las imágenes', () => {
    expect(() => validateEnv({ ...validEnv, UPLOADS_DIR: '' })).toThrow('UPLOADS_DIR');
    expect(() => validateEnv({ ...validEnv, PUBLIC_UPLOADS_BASE_URL: '' })).toThrow(
      'PUBLIC_UPLOADS_BASE_URL',
    );
  });
});
