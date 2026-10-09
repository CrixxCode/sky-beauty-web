import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { AdminRole } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/shared/prisma/prisma.service';
import { hashPassword } from '../../src/shared/security/password';

/** Crea la aplicación completa con la misma configuración que main.ts. */
export async function createTestApp(): Promise<{
  app: NestExpressApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export const TEST_PASSWORD = 'clave-de-prueba-123';

export async function createAdminUser(
  prisma: PrismaService,
  data: { email: string; name?: string; role?: AdminRole; isActive?: boolean },
) {
  return prisma.adminUser.create({
    data: {
      email: data.email,
      name: data.name ?? 'Usuario de prueba',
      role: data.role ?? AdminRole.ADMIN,
      isActive: data.isActive ?? true,
      passwordHash: await hashPassword(TEST_PASSWORD),
    },
  });
}

/** Devuelve un agente HTTP con la sesión iniciada (conserva la cookie entre peticiones). */
export async function loginAgent(
  app: NestExpressApplication,
  email: string,
  password = TEST_PASSWORD,
) {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/v1/admin/auth/login').send({ email, password }).expect(200);
  return agent;
}
