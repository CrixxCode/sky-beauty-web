import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaPg } from '@prisma/adapter-pg';
import { resetOwnerPassword } from '../src/cli/reset-owner-password';
import { AdminRole, PrismaClient } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent, TEST_PASSWORD } from './utils/app';
import { resetDatabase } from './utils/database';

const USERS = '/api/v1/admin/users';

describe('Cuentas del panel (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(async () => {
    await resetDatabase(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test', name: 'Dueña' });
  });
  afterAll(() => app.close());

  it('el personal no puede gestionar cuentas', async () => {
    await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
    const staff = await loginAgent(app, 'personal@ejemplo.test');

    await staff.get(USERS).expect(403);
    await staff
      .post(USERS)
      .send({ email: 'otro@ejemplo.test', name: 'Otro', password: 'clave-segura-123' })
      .expect(403);
  });

  it('la propietaria crea cuentas del personal y las lista sin datos sensibles', async () => {
    const owner = await loginAgent(app, 'duena@ejemplo.test');

    const created = await owner
      .post(USERS)
      .send({ email: ' Nueva@Ejemplo.test ', name: ' Ana ', password: 'clave-segura-123' })
      .expect(201);
    expect(created.body).toMatchObject({
      email: 'nueva@ejemplo.test',
      name: 'Ana',
      role: 'STAFF',
      isActive: true,
    });

    const list = await owner.get(USERS).expect(200);
    expect(list.body).toHaveLength(2);
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');

    // La cuenta nueva puede iniciar sesión.
    await loginAgent(app, 'nueva@ejemplo.test', 'clave-segura-123');
  });

  it('no permite correos repetidos ni contraseñas cortas', async () => {
    const owner = await loginAgent(app, 'duena@ejemplo.test');
    await owner
      .post(USERS)
      .send({ email: 'duena@ejemplo.test', name: 'Repetida', password: 'clave-segura-123' })
      .expect(409);
    await owner
      .post(USERS)
      .send({ email: 'nueva@ejemplo.test', name: 'Corta', password: 'corta' })
      .expect(400);
  });

  it('desactivar una cuenta cierra sus sesiones', async () => {
    const staffUser = await createAdminUser(prisma, {
      email: 'personal@ejemplo.test',
      role: AdminRole.STAFF,
    });
    const staff = await loginAgent(app, 'personal@ejemplo.test');
    const owner = await loginAgent(app, 'duena@ejemplo.test');

    await owner.patch(`${USERS}/${staffUser.id}`).send({ isActive: false }).expect(200);

    await staff.get('/api/v1/admin/auth/me').expect(401);
  });

  it('restablecer la contraseña del personal quita el bloqueo y cierra sus sesiones', async () => {
    const staffUser = await createAdminUser(prisma, {
      email: 'personal@ejemplo.test',
      role: AdminRole.STAFF,
    });
    const staff = await loginAgent(app, 'personal@ejemplo.test');
    await prisma.adminUser.update({
      where: { id: staffUser.id },
      data: { lockedUntil: new Date(Date.now() + 60 * 60_000) },
    });
    const owner = await loginAgent(app, 'duena@ejemplo.test');

    await owner
      .post(`${USERS}/${staffUser.id}/reset-password`)
      .send({ newPassword: 'clave-restablecida' })
      .expect(204);

    await staff.get('/api/v1/admin/auth/me').expect(401);
    await loginAgent(app, 'personal@ejemplo.test', 'clave-restablecida');
  });

  it('la propietaria no puede modificar cuentas ADMIN desde la gestión del personal', async () => {
    const ownerUser = await prisma.adminUser.findUniqueOrThrow({
      where: { email: 'duena@ejemplo.test' },
    });
    const owner = await loginAgent(app, 'duena@ejemplo.test');

    await owner.patch(`${USERS}/${ownerUser.id}`).send({ isActive: false }).expect(404);
    await owner
      .post(`${USERS}/${ownerUser.id}/reset-password`)
      .send({ newPassword: 'clave-restablecida' })
      .expect(404);
  });

  describe('comando de recuperación de la propietaria', () => {
    const cliPrisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
    afterAll(() => cliPrisma.$disconnect());

    it('restablece la contraseña, quita el bloqueo y cierra las sesiones', async () => {
      const owner = await loginAgent(app, 'duena@ejemplo.test');
      await prisma.adminUser.update({
        where: { email: 'duena@ejemplo.test' },
        data: { lockedUntil: new Date(Date.now() + 60 * 60_000), failedLoginAttempts: 3 },
      });

      await resetOwnerPassword(cliPrisma, 'DUENA@ejemplo.test', 'clave-recuperada-123');

      await owner.get('/api/v1/admin/auth/me').expect(401);
      await loginAgent(app, 'duena@ejemplo.test', 'clave-recuperada-123');
    });

    it('no sirve para cuentas del personal ni acepta contraseñas cortas', async () => {
      await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
      await expect(
        resetOwnerPassword(cliPrisma, 'personal@ejemplo.test', 'clave-recuperada-123'),
      ).rejects.toThrow('No existe una cuenta de propietaria');
      await expect(resetOwnerPassword(cliPrisma, 'duena@ejemplo.test', 'corta')).rejects.toThrow(
        'al menos 12',
      );
      await loginAgent(app, 'duena@ejemplo.test', TEST_PASSWORD);
    });
  });
});
