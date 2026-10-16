/** Las herramientas que vacían datos solo pueden usar una base PostgreSQL cuyo nombre termine en _test. */
export function assertTestDatabaseUrl(value: string | undefined): asserts value is string {
  if (!value) throw new Error('TEST_DATABASE_URL no está definida.');
  const url = new URL(value);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !name.endsWith('_test')) {
    throw new Error(
      'TEST_DATABASE_URL debe apuntar a una base PostgreSQL cuyo nombre termine en "_test".',
    );
  }
}
