/**
 * Solo para las pruebas de punta a punta (Playwright): simula que pasaron `horas` desde que se creó
 * un pedido, moviendo su fecha de creación hacia atrás. Después, frontend/e2e ejecuta el ciclo de
 * plazos con el comando compilado (dist-e2e/cli/run-order-deadlines.js).
 * Uso: tsx test/e2e-advance-order.ts <código del pedido> <horas>
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

async function main(): Promise<void> {
  const [code, hoursArg] = process.argv.slice(2);
  const hours = Number(hoursArg);
  const { DATABASE_URL } = process.env;
  if (!code || !Number.isFinite(hours)) throw new Error('Uso: e2e-advance-order <código> <horas>');
  if (!DATABASE_URL?.includes('_test')) {
    throw new Error('Por seguridad, este script solo se ejecuta en una base *_test.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(DATABASE_URL) });
  try {
    await prisma.order.update({
      where: { code },
      data: { createdAt: new Date(Date.now() - hours * 60 * 60 * 1000) },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
