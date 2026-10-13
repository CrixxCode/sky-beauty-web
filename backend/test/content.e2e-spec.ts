import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const CONTENT = '/api/v1/admin/content';
const PAGES = '/api/v1/store/content';
const INFO = '/api/v1/store/info';

describe('Contenido y páginas legales (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
    await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
  });

  afterAll(() => app.close());

  it('el personal consulta el contenido; solo la propietaria lo modifica', async () => {
    const staff = await loginAgent(app, 'personal@ejemplo.test');
    await staff.get(CONTENT).expect(200);
    await staff.patch(CONTENT).send({ heroTitle: 'Título ficticio' }).expect(403);
    await request(app.getHttpServer()).get(CONTENT).expect(401);
  });

  it('guarda los textos recortados y un texto vacío lo borra', async () => {
    const owner = await loginAgent(app, 'duena@ejemplo.test');
    const saved = await owner
      .patch(CONTENT)
      .send({
        heroTitle: '  Título ficticio  ',
        heroSubtitle: 'Subtítulo ficticio',
        announcementText: 'Anuncio ficticio',
        tagline: 'Descripción ficticia para buscadores',
      })
      .expect(200);
    expect(saved.body).toMatchObject({
      heroTitle: 'Título ficticio',
      announcementText: 'Anuncio ficticio',
      termsText: null,
    });

    const cleared = await owner.patch(CONTENT).send({ announcementText: '   ' }).expect(200);
    expect(cleared.body).toMatchObject({ announcementText: null, heroTitle: 'Título ficticio' });

    await owner
      .patch(CONTENT)
      .send({ announcementText: 'x'.repeat(161) })
      .expect(400);
  });

  it('una página legal sin texto no existe; con texto se publica', async () => {
    const owner = await loginAgent(app, 'duena@ejemplo.test');
    await request(app.getHttpServer()).get(`${PAGES}/terminos`).expect(404);
    expect((await request(app.getHttpServer()).get(INFO).expect(200)).body).toMatchObject({
      publishedPages: [],
    });

    await owner
      .patch(CONTENT)
      .send({
        termsText: '# Términos ficticios\n\nTexto de prueba.',
        shippingPolicyText: 'Envíos ficticios.',
      })
      .expect(200);

    const page = await request(app.getHttpServer()).get(`${PAGES}/terminos`).expect(200);
    expect(page.body).toEqual({
      slug: 'terminos',
      title: 'Términos y condiciones',
      text: '# Términos ficticios\n\nTexto de prueba.',
    });
    await request(app.getHttpServer()).get(`${PAGES}/datos-personales`).expect(404);
    expect((await request(app.getHttpServer()).get(INFO).expect(200)).body).toMatchObject({
      publishedPages: ['terminos', 'envios'],
    });
  });

  it('no responde páginas inexistentes ni nombres especiales', async () => {
    for (const slug of ['nosotros', '__proto__', 'constructor', 'toString']) {
      await request(app.getHttpServer()).get(`${PAGES}/${slug}`).expect(404);
    }
  });

  it('la información pública incluye el anuncio y la descripción', async () => {
    const owner = await loginAgent(app, 'duena@ejemplo.test');
    await owner
      .patch(CONTENT)
      .send({ announcementText: 'Anuncio ficticio', tagline: 'Descripción ficticia' })
      .expect(200);
    expect((await request(app.getHttpServer()).get(INFO).expect(200)).body).toMatchObject({
      announcementText: 'Anuncio ficticio',
      tagline: 'Descripción ficticia',
    });
  });
});
