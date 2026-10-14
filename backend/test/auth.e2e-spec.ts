import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AdminRole } from '../src/generated/prisma/client';
import { SESSION_COOKIE } from '../src/modules/auth/auth.types';
import { SessionService } from '../src/modules/auth/session.service';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent, TEST_PASSWORD } from './utils/app';
import { resetDatabase } from './utils/database';

const LOGIN = '/api/v1/admin/auth/login';
const ME = '/api/v1/admin/auth/me';

/** Mensaje de error del cuerpo de una respuesta de la API. */
const messageOf = (res: request.Response) => (res.body as { message: unknown }).message;

describe('Acceso al panel (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });
  beforeEach(() => resetDatabase(prisma));
  afterAll(() => app.close());

  const server = () => app.getHttpServer();

  describe('inicio de sesión', () => {
    it('crea una sesión con cookie httpOnly y devuelve el perfil', async () => {
      await createAdminUser(prisma, { email: 'duena@ejemplo.test', name: 'Dueña' });

      const res = await request(server())
        .post(LOGIN)
        .send({ email: '  Duena@Ejemplo.TEST ', password: TEST_PASSWORD })
        .expect(200);

      expect(res.body).toMatchObject({ email: 'duena@ejemplo.test', name: 'Dueña', role: 'ADMIN' });
      expect(res.body).not.toHaveProperty('passwordHash');
      const cookie = String(res.headers['set-cookie']);
      expect(cookie).toContain(`${SESSION_COOKIE}=`);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(await prisma.adminSession.count()).toBe(1);
    });

    it('responde el mismo error para correo inexistente y contraseña incorrecta', async () => {
      await createAdminUser(prisma, { email: 'duena@ejemplo.test' });

      const wrongPassword = await request(server())
        .post(LOGIN)
        .send({ email: 'duena@ejemplo.test', password: 'otra-clave-123' })
        .expect(401);
      const unknownEmail = await request(server())
        .post(LOGIN)
        .send({ email: 'nadie@ejemplo.test', password: 'otra-clave-123' })
        .expect(401);

      expect(messageOf(wrongPassword)).toBe(messageOf(unknownEmail));
    });

    it('rechaza cuentas desactivadas con el mismo error genérico', async () => {
      await createAdminUser(prisma, { email: 'inactiva@ejemplo.test', isActive: false });
      const res = await request(server())
        .post(LOGIN)
        .send({ email: 'inactiva@ejemplo.test', password: TEST_PASSWORD })
        .expect(401);
      expect(messageOf(res)).toBe('Correo o contraseña incorrectos.');
    });

    it('bloquea la cuenta tras los intentos fallidos configurados', async () => {
      await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
      const max = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS);

      for (let i = 0; i < max; i++) {
        await request(server())
          .post(LOGIN)
          .send({ email: 'duena@ejemplo.test', password: 'incorrecta-123' })
          .expect(401);
      }

      // Bloqueada: ni siquiera la contraseña correcta funciona.
      const res = await request(server())
        .post(LOGIN)
        .send({ email: 'duena@ejemplo.test', password: TEST_PASSWORD })
        .expect(429);
      expect(messageOf(res)).toContain('bloqueada temporalmente');
    });

    it('valida el formato de los datos', async () => {
      await request(server()).post(LOGIN).send({ email: 'no-es-correo', password: '' }).expect(400);
    });
  });

  describe('sesión', () => {
    it('protege por defecto las rutas del panel', async () => {
      await request(server()).get(ME).expect(401);
      await request(server()).get(ME).set('Cookie', `${SESSION_COOKIE}=token-falso`).expect(401);
    });

    it('permite consultar el perfil con la sesión iniciada', async () => {
      await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
      const agent = await loginAgent(app, 'personal@ejemplo.test');
      const res = await agent.get(ME).expect(200);
      expect(res.body).toMatchObject({ email: 'personal@ejemplo.test', role: 'STAFF' });
    });

    it('cierra la sesión: la cookie anterior deja de servir', async () => {
      await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
      const agent = await loginAgent(app, 'duena@ejemplo.test');
      const session = await prisma.adminSession.findFirstOrThrow();

      await agent.post('/api/v1/admin/auth/logout').expect(204);

      expect(
        (await prisma.adminSession.findUniqueOrThrow({ where: { id: session.id } })).revokedAt,
      ).not.toBeNull();
      await agent.get(ME).expect(401);
    });

    it('borra las sesiones vencidas o cerradas hace más de 30 días', async () => {
      const admin = await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
      await loginAgent(app, 'duena@ejemplo.test');
      const day = 24 * 60 * 60_000;
      const ago = (days: number) => new Date(Date.now() - days * day);
      const old = await prisma.adminSession.createMany({
        data: [
          { adminUserId: admin.id, expiresAt: ago(31) },
          { adminUserId: admin.id, expiresAt: ago(-1), revokedAt: ago(40) },
          { adminUserId: admin.id, expiresAt: ago(5) },
        ],
      });
      expect(old.count).toBe(3);

      expect(await app.get(SessionService).purgeExpired()).toBe(2);
      // Quedan la sesión activa y la vencida hace 5 días.
      expect(await prisma.adminSession.count()).toBe(2);
    });

    it('rechaza sesiones de cuentas que fueron desactivadas', async () => {
      const user = await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
      const agent = await loginAgent(app, 'duena@ejemplo.test');
      await prisma.adminUser.update({ where: { id: user.id }, data: { isActive: false } });
      await agent.get(ME).expect(401);
    });

    it('la ruta de salud sigue siendo pública', async () => {
      await request(server()).get('/api/v1/health').expect(200);
    });
  });

  describe('cambio de contraseña propia', () => {
    const PASSWORD = '/api/v1/admin/auth/password';

    it('exige la contraseña actual correcta', async () => {
      await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
      const agent = await loginAgent(app, 'duena@ejemplo.test');
      await agent
        .patch(PASSWORD)
        .send({ currentPassword: 'no-es-esta-123', newPassword: 'nueva-clave-segura' })
        .expect(400);
    });

    it('exige una contraseña nueva de al menos 12 caracteres', async () => {
      await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
      const agent = await loginAgent(app, 'duena@ejemplo.test');
      await agent
        .patch(PASSWORD)
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'corta' })
        .expect(400);
    });

    it('cambia la contraseña y cierra las demás sesiones, conservando la actual', async () => {
      await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
      const current = await loginAgent(app, 'duena@ejemplo.test');
      const other = await loginAgent(app, 'duena@ejemplo.test');

      await current
        .patch(PASSWORD)
        .send({ currentPassword: TEST_PASSWORD, newPassword: 'nueva-clave-segura' })
        .expect(204);

      await current.get(ME).expect(200);
      await other.get(ME).expect(401);
      await loginAgent(app, 'duena@ejemplo.test', 'nueva-clave-segura');
    });
  });
});
