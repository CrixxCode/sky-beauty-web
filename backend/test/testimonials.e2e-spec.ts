import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { seed } from '../prisma/seed';
import { AdminRole } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/shared/prisma/prisma.service';
import { createAdminUser, createTestApp, loginAgent } from './utils/app';
import { resetDatabase } from './utils/database';

const ADMIN = '/api/v1/admin/testimonials';
const STORE = '/api/v1/store/testimonials';

type Agent = Awaited<ReturnType<typeof loginAgent>>;
type PublicTestimonial = {
  authorName: string;
  rating: number;
  comment: string;
  product: { name: string; slug: string } | null;
};

describe('Testimonios (integración)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let owner: Agent;
  let staff: Agent;
  let productId: string;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await seed(prisma);
    await createAdminUser(prisma, { email: 'duena@ejemplo.test' });
    await createAdminUser(prisma, { email: 'personal@ejemplo.test', role: AdminRole.STAFF });
    owner = await loginAgent(app, 'duena@ejemplo.test');
    staff = await loginAgent(app, 'personal@ejemplo.test');

    const brand = await prisma.brand.create({ data: { name: 'Marca Ficticia', slug: 'marca' } });
    const category = await prisma.category.create({
      data: { name: 'Categoría Ficticia', slug: 'categoria' },
    });
    productId = (
      await prisma.product.create({
        data: {
          name: 'Labial Ficticio',
          slug: 'labial-ficticio',
          description: 'Producto ficticio.',
          brandId: brand.id,
          categoryId: category.id,
          basePrice: 10000,
          status: 'ACTIVE',
        },
      })
    ).id;
  });

  afterAll(() => app.close());

  const body = (overrides: Record<string, unknown> = {}) => ({
    firstName: 'Clienta Ficticia',
    lastInitial: 'g.',
    rating: 5,
    comment: 'Comentario ficticio de prueba.',
    ...overrides,
  });

  it('solo la propietaria crea, edita y elimina; el personal solo consulta', async () => {
    await staff.post(ADMIN).send(body()).expect(403);
    await request(app.getHttpServer()).get(ADMIN).expect(401);

    const created = (await owner.post(ADMIN).send(body()).expect(201)).body as {
      id: string;
      lastInitial: string;
      isPublished: boolean;
    };
    expect(created.lastInitial).toBe('G');
    expect(created.isPublished).toBe(false);

    await staff.get(ADMIN).expect(200);
    await staff.patch(`${ADMIN}/${created.id}`).send({ isPublished: true }).expect(403);
    await staff.delete(`${ADMIN}/${created.id}`).expect(403);
    await owner.delete(`${ADMIN}/${created.id}`).expect(204);
    await owner.delete(`${ADMIN}/${created.id}`).expect(404);
  });

  it('valida la valoración, la inicial y el producto', async () => {
    await owner
      .post(ADMIN)
      .send(body({ rating: 0 }))
      .expect(400);
    await owner
      .post(ADMIN)
      .send(body({ rating: 6 }))
      .expect(400);
    await owner
      .post(ADMIN)
      .send(body({ lastInitial: 'Go' }))
      .expect(400);
    await owner
      .post(ADMIN)
      .send(body({ comment: '   ' }))
      .expect(400);
    await owner
      .post(ADMIN)
      .send(body({ productId: '00000000-0000-4000-8000-000000000000' }))
      .expect(400);
  });

  it('la tienda solo muestra los publicados, con la inicial y el producto si sigue publicado', async () => {
    await owner
      .post(ADMIN)
      .send(body({ comment: 'Borrador ficticio.' }))
      .expect(201);
    const published = (
      await owner
        .post(ADMIN)
        .send(body({ isPublished: true, productId, rating: 4 }))
        .expect(201)
    ).body as { id: string };

    const list = async () =>
      (await request(app.getHttpServer()).get(STORE).expect(200)).body as PublicTestimonial[];

    expect(await list()).toEqual([
      {
        id: published.id,
        authorName: 'Clienta Ficticia G.',
        rating: 4,
        comment: 'Comentario ficticio de prueba.',
        product: { name: 'Labial Ficticio', slug: 'labial-ficticio' },
      },
    ]);

    // Si el producto deja de estar publicado, el testimonio sigue sin enlazarlo.
    await prisma.product.update({ where: { id: productId }, data: { status: 'INACTIVE' } });
    expect((await list())[0].product).toBeNull();

    await owner.patch(`${ADMIN}/${published.id}`).send({ isPublished: false }).expect(200);
    expect(await list()).toEqual([]);
  });
});
