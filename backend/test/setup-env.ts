// Las pruebas de integración se ejecutan siempre contra la base de pruebas, nunca contra la de desarrollo.
import 'dotenv/config';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL no está definida; las pruebas de integración no pueden ejecutarse.',
  );
}
if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL no puede ser igual a DATABASE_URL.');
}
// Las suites vacían la base: solo se aceptan bases cuyo nombre termina en "_test", aunque la URL
// esté escrita distinto a DATABASE_URL (otro host o parámetros) o apunte a otra base real.
const testDatabaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname.replace(/^\//, ''));
if (!testDatabaseName.endsWith('_test')) {
  throw new Error(
    `TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en "_test" (es "${testDatabaseName}").`,
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
// Las fotos de las pruebas van a una carpeta temporal, nunca a la de desarrollo. Se define aquí,
// antes de importar la aplicación: la configuración se lee al cargar los módulos.
process.env.UPLOADS_DIR = mkdtempSync(join(tmpdir(), 'sky-beauty-uploads-'));
