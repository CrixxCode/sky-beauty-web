/**
 * Restablece la contraseña de una cuenta de la propietaria (ADMIN) desde el servidor.
 * Es el mecanismo de recuperación cuando la propietaria olvida su contraseña (ver Context/decisiones.md).
 *
 * Uso (la contraseña nueva se pasa por variable de entorno para que no quede en el historial):
 *   NEW_OWNER_PASSWORD='...' npm run owner:reset-password -- --email propietaria@ejemplo.com
 *
 * Quita el bloqueo por intentos fallidos y cierra todas las sesiones abiertas de esa cuenta.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { AdminRole, PrismaClient } from '../generated/prisma/client';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../shared/security/password';

export async function resetOwnerPassword(
  prisma: PrismaClient,
  email: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  const owner = await prisma.adminUser.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!owner || owner.role !== AdminRole.ADMIN) {
    throw new Error('No existe una cuenta de propietaria (ADMIN) con ese correo.');
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.adminUser.update({
      where: { id: owner.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        failedLoginAttempts: 0,
        lockedUntil: null,
        isActive: true,
      },
    }),
    prisma.adminSession.updateMany({
      where: { adminUserId: owner.id, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
}

function readEmailArg(argv: string[]): string | undefined {
  const index = argv.indexOf('--email');
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const email = readEmailArg(process.argv);
  const newPassword = process.env.NEW_OWNER_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;
  if (!email || !newPassword || !databaseUrl) {
    throw new Error(
      'Uso: NEW_OWNER_PASSWORD=<contraseña> npm run owner:reset-password -- --email <correo> (requiere DATABASE_URL).',
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  try {
    await resetOwnerPassword(prisma, email, newPassword);
    console.log('Contraseña restablecida. Se cerraron las sesiones abiertas de la cuenta.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
