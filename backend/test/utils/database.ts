import type { PrismaClient } from '../../src/generated/prisma/client';

/** Tablas de referencia que se cargan con las migraciones y no se borran entre pruebas. */
const PRESERVED_TABLES = new Set(['_prisma_migrations', 'Department', 'Municipality']);

/** Vacía todas las tablas de la base de pruebas, excepto las de referencia. */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  const tables = rows.map((r) => r.tablename).filter((name) => !PRESERVED_TABLES.has(name));
  if (tables.length === 0) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.map((name) => `"${name}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
