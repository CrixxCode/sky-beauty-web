// Las pruebas de integración se ejecutan siempre contra la base de pruebas, nunca contra la de desarrollo.
import 'dotenv/config';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL no está definida; las pruebas de integración no pueden ejecutarse.',
  );
}
if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL no puede ser igual a DATABASE_URL.');
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
