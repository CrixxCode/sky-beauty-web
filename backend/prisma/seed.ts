/**
 * Datos iniciales de Sky Beauty. Es idempotente: se puede ejecutar varias veces sin duplicar
 * ni sobrescribir lo que la propietaria ya haya configurado.
 *
 * Crea, solo si no existen:
 * - la fila de configuración de la tienda, con las cifras configurables vacías;
 * - los 4 métodos de pago del contexto, inactivos hasta que la propietaria configure sus instrucciones
 *   (contra entrega queda restringido a municipios, con la lista vacía);
 * - la cuenta de la propietaria, si se definen SEED_OWNER_EMAIL, SEED_OWNER_NAME y SEED_OWNER_PASSWORD
 *   y aún no existe ninguna cuenta ADMIN.
 *
 * Uso: npm run db:seed
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { AdminRole, PrismaClient } from '../src/generated/prisma/client';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../src/shared/security/password';

export const INITIAL_PAYMENT_METHODS = [
  {
    code: 'BANK_TRANSFER',
    name: 'Transferencia bancaria',
    requiresVerification: true,
    restrictToCities: false,
  },
  { code: 'NEQUI', name: 'Nequi', requiresVerification: true, restrictToCities: false },
  { code: 'DAVIPLATA', name: 'Daviplata', requiresVerification: true, restrictToCities: false },
  {
    code: 'CASH_ON_DELIVERY',
    name: 'Efectivo contra entrega',
    requiresVerification: false,
    restrictToCities: true,
  },
] as const;

export interface SeedOwner {
  email: string;
  name: string;
  password: string;
}

export interface SeedResult {
  storeSettingsCreated: boolean;
  paymentMethodsCreated: string[];
  owner: 'created' | 'already-exists' | 'skipped';
}

export async function seed(prisma: PrismaClient, owner?: SeedOwner): Promise<SeedResult> {
  const settingsBefore = await prisma.storeSettings.count();
  await prisma.storeSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  const existingCodes = new Set(
    (await prisma.paymentMethod.findMany({ select: { code: true } })).map((m) => m.code),
  );
  const paymentMethodsCreated: string[] = [];
  for (const [position, method] of INITIAL_PAYMENT_METHODS.entries()) {
    if (existingCodes.has(method.code)) continue;
    await prisma.paymentMethod.create({ data: { ...method, position, isActive: false } });
    paymentMethodsCreated.push(method.code);
  }

  let ownerResult: SeedResult['owner'] = 'skipped';
  if ((await prisma.adminUser.count({ where: { role: AdminRole.ADMIN } })) > 0) {
    ownerResult = 'already-exists';
  } else if (owner) {
    if (owner.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`SEED_OWNER_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }
    await prisma.adminUser.create({
      data: {
        email: owner.email.trim().toLowerCase(),
        name: owner.name.trim(),
        passwordHash: await hashPassword(owner.password),
        role: AdminRole.ADMIN,
      },
    });
    ownerResult = 'created';
  }

  return { storeSettingsCreated: settingsBefore === 0, paymentMethodsCreated, owner: ownerResult };
}

function ownerFromEnv(): SeedOwner | undefined {
  const {
    SEED_OWNER_EMAIL: email,
    SEED_OWNER_NAME: name,
    SEED_OWNER_PASSWORD: password,
  } = process.env;
  if (!email && !name && !password) return undefined;
  if (!email || !name || !password) {
    throw new Error(
      'Para crear la cuenta de la propietaria se necesitan SEED_OWNER_EMAIL, SEED_OWNER_NAME y SEED_OWNER_PASSWORD.',
    );
  }
  return { email, name, password };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL no está definida.');

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  try {
    const result = await seed(prisma, ownerFromEnv());
    console.log(
      'Configuración de la tienda:',
      result.storeSettingsCreated ? 'creada' : 'ya existía',
    );
    console.log(
      'Métodos de pago creados:',
      result.paymentMethodsCreated.join(', ') || 'ninguno (ya existían)',
    );
    const ownerMessages = {
      created: 'cuenta creada. Quita SEED_OWNER_PASSWORD del .env.',
      'already-exists': 'ya existe una cuenta ADMIN; no se creó otra.',
      skipped: 'no se creó (faltan las variables SEED_OWNER_*).',
    };
    console.log('Propietaria:', ownerMessages[result.owner]);
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
