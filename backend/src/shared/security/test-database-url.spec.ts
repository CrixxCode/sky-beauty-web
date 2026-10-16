import { assertTestDatabaseUrl } from './test-database-url';

describe('protección de bases de pruebas (BE-218)', () => {
  it.each([
    undefined,
    'postgresql://localhost/sky_beauty',
    'postgresql://localhost/sky_beauty?schema=public_test',
    'postgresql://localhost/sky_test_real',
    'postgresql://localhost/sky_test%5Freal',
    'https://localhost/sky_test',
  ])('rechaza %s antes de borrar o migrar datos', (url) => {
    expect(() => assertTestDatabaseUrl(url)).toThrow();
  });

  it('acepta una base aislada con el sufijo exacto', () => {
    expect(() =>
      assertTestDatabaseUrl('postgresql://localhost/sky_test?schema=public'),
    ).not.toThrow();
  });
});
