import { PrismaPg } from '@prisma/adapter-pg';
import { INITIAL_PAYMENT_METHODS, seed } from '../prisma/seed';
import { PrismaClient } from '../src/generated/prisma/client';
import { verifyPassword } from '../src/shared/security/password';
import { resetDatabase } from './utils/database';

describe('Datos iniciales (integración)', () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  const owner = {
    email: ' Propietaria@Ejemplo.test ',
    name: 'Propietaria de prueba',
    password: 'clave-de-prueba-123',
  };

  beforeEach(() => resetDatabase(prisma));
  afterAll(() => prisma.$disconnect());

  it('crea la configuración, los métodos de pago inactivos y la cuenta de la propietaria', async () => {
    const result = await seed(prisma, owner);

    expect(result).toEqual({
      storeSettingsCreated: true,
      paymentMethodsCreated: INITIAL_PAYMENT_METHODS.map((m) => m.code),
      owner: 'created',
    });

    const settings = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(settings.freeShippingThreshold).toBeNull();
    expect(settings.defaultLowStockThreshold).toBeNull();
    expect(settings.maxPercentageDiscount).toBeNull();

    const methods = await prisma.paymentMethod.findMany({ orderBy: { position: 'asc' } });
    expect(methods.map((m) => m.code)).toEqual([
      'BANK_TRANSFER',
      'NEQUI',
      'DAVIPLATA',
      'CASH_ON_DELIVERY',
    ]);
    expect(methods.every((m) => !m.isActive)).toBe(true);
    const cod = methods.find((m) => m.code === 'CASH_ON_DELIVERY')!;
    expect(cod).toMatchObject({ requiresVerification: false, restrictToCities: true });

    const admin = await prisma.adminUser.findUniqueOrThrow({
      where: { email: 'propietaria@ejemplo.test' },
    });
    expect(admin.role).toBe('ADMIN');
    expect(await verifyPassword(admin.passwordHash, owner.password)).toBe(true);
  });

  it('es idempotente y no sobrescribe la configuración existente', async () => {
    await seed(prisma, owner);
    await prisma.paymentMethod.update({
      where: { code: 'NEQUI' },
      data: { isActive: true, instructions: 'Instrucciones' },
    });

    const second = await seed(prisma, { ...owner, email: 'otra@ejemplo.test' });

    expect(second).toEqual({
      storeSettingsCreated: false,
      paymentMethodsCreated: [],
      owner: 'already-exists',
    });
    expect(await prisma.adminUser.count()).toBe(1);
    expect(await prisma.paymentMethod.count()).toBe(4);
    const nequi = await prisma.paymentMethod.findUniqueOrThrow({ where: { code: 'NEQUI' } });
    expect(nequi).toMatchObject({ isActive: true, instructions: 'Instrucciones' });
  });

  it('no crea la cuenta sin datos de la propietaria', async () => {
    const result = await seed(prisma);
    expect(result.owner).toBe('skipped');
    expect(await prisma.adminUser.count()).toBe(0);
  });

  it('rechaza contraseñas cortas', async () => {
    await expect(seed(prisma, { ...owner, password: 'corta' })).rejects.toThrow(
      'al menos 12 caracteres',
    );
  });

  it('conserva los datos de referencia del DANE', async () => {
    expect(await prisma.municipality.count()).toBe(1122);
  });
});
