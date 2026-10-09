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
  STORAGE_DRIVER: 'local',
  PUBLIC_UPLOADS_BASE_URL: 'http://localhost:4000/uploads',
  MAX_IMAGE_SIZE_MB: '5',
  S3_BUCKET: '',
};

describe('validateEnv', () => {
  it('convierte y normaliza las variables válidas', () => {
    const env = validateEnv(validEnv);
    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://skybeauty.test']);
    expect(env.ORDER_UNPAID_TTL_HOURS).toBe(24);
    expect(env.S3_BUCKET).toBeUndefined();
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
  });

  it('rechaza un JWT_SECRET corto', () => {
    expect(() => validateEnv({ ...validEnv, JWT_SECRET: 'corto' })).toThrow('JWT_SECRET');
  });

  it('exige los plazos de cancelación', () => {
    expect(() =>
      validateEnv({ ...validEnv, ORDER_PAYMENT_CLARIFICATION_HOURS: undefined }),
    ).toThrow('ORDER_PAYMENT_CLARIFICATION_HOURS');
  });

  it('exige la URL pública de archivos con almacenamiento local', () => {
    expect(() => validateEnv({ ...validEnv, PUBLIC_UPLOADS_BASE_URL: '' })).toThrow(
      'PUBLIC_UPLOADS_BASE_URL',
    );
  });

  it('exige las credenciales de S3 cuando STORAGE_DRIVER=s3', () => {
    expect(() => validateEnv({ ...validEnv, STORAGE_DRIVER: 's3' })).toThrow('S3_BUCKET');
  });
});
