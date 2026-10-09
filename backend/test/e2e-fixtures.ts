/**
 * Prepara la base de pruebas para las pruebas de punta a punta del frontend (Playwright):
 * la vacía (salvo datos de referencia) y crea la cuenta de la propietaria de prueba.
 * La ejecuta frontend/e2e/global-setup.ts con DATABASE_URL apuntando a la base de pruebas.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { AdminRole, PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/shared/security/password';
import { resetDatabase } from './utils/database';

async function main(): Promise<void> {
  const { DATABASE_URL, E2E_OWNER_EMAIL, E2E_OWNER_NAME, E2E_OWNER_PASSWORD } = process.env;
  if (!DATABASE_URL || !E2E_OWNER_EMAIL || !E2E_OWNER_NAME || !E2E_OWNER_PASSWORD) {
    throw new Error('Faltan DATABASE_URL o las variables E2E_OWNER_*.');
  }
  if (!DATABASE_URL.includes('_test')) {
    throw new Error(
      'Por seguridad, las pruebas de punta a punta solo se ejecutan en una base *_test.',
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(DATABASE_URL) });
  try {
    await resetDatabase(prisma);
    await prisma.adminUser.create({
      data: {
        email: E2E_OWNER_EMAIL,
        name: E2E_OWNER_NAME,
        role: AdminRole.ADMIN,
        passwordHash: await hashPassword(E2E_OWNER_PASSWORD),
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
