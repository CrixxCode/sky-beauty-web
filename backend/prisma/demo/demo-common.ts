/**
 * Marcas de los datos de demostración (prisma/demo). Todo lo que crea seed-demo es
 * evidentemente ficticio y se puede borrar con clean-demo:
 * - productos con `isDemo = true`;
 * - marcas, categorías, promociones y la transportadora cuyo nombre empieza por "Demo";
 * - testimonios cuyo nombre empieza por "Demo";
 * - clientes con teléfonos 57300000XXXX;
 * - la cuenta del panel DEMO_ADMIN_EMAIL, que solo usa el script.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

export const DEMO_PREFIX = 'Demo';
export const DEMO_ADMIN_EMAIL = 'demo.script@ejemplo.test';
export const DEMO_CARRIER = 'Transportadora Demo';
/** Teléfonos de los clientes ficticios: 3000000001, 3000000002… (se guardan con el 57). */
export const DEMO_PHONE_PREFIX = '57300000';

/** Los datos de demostración nunca se cargan en producción. */
export function demoPrisma(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Los datos de demostración no se cargan ni se borran en producción.');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no está definida.');
  return new PrismaClient({ adapter: new PrismaPg(url) });
}
