import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type {
  CreateTestimonialDto,
  PublicTestimonialDto,
  TestimonialDto,
  UpdateTestimonialDto,
} from './testimonials.dto';

/** Testimonios que muestra la tienda, del más reciente al más antiguo. */
const PUBLIC_LIMIT = 6;

const include = { product: { select: { name: true, slug: true, status: true } } } as const;

type TestimonialRow = {
  id: string;
  firstName: string;
  lastInitial: string;
  rating: number;
  comment: string;
  productId: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  product: { name: string; slug: string; status: string } | null;
};

function toDto(row: TestimonialRow): TestimonialDto {
  return {
    id: row.id,
    firstName: row.firstName,
    lastInitial: row.lastInitial,
    rating: row.rating,
    comment: row.comment,
    productId: row.productId,
    productName: row.product?.name ?? null,
    isPublished: row.isPublished,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class TestimonialsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<TestimonialDto[]> {
    const rows = await this.prisma.testimonial.findMany({
      include,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDto);
  }

  /** Publicados. El producto solo se muestra si sigue publicado (los demás no tienen página). */
  async listPublic(): Promise<PublicTestimonialDto[]> {
    const rows = await this.prisma.testimonial.findMany({
      where: { isPublished: true },
      include,
      orderBy: { createdAt: 'desc' },
      take: PUBLIC_LIMIT,
    });
    return rows.map((row) => ({
      id: row.id,
      authorName: `${row.firstName} ${row.lastInitial}.`,
      rating: row.rating,
      comment: row.comment,
      product:
        row.product?.status === 'ACTIVE'
          ? { name: row.product.name, slug: row.product.slug }
          : null,
    }));
  }

  async create(dto: CreateTestimonialDto): Promise<TestimonialDto> {
    await this.assertProduct(dto.productId);
    const row = await this.prisma.testimonial.create({
      data: {
        firstName: dto.firstName,
        lastInitial: dto.lastInitial,
        rating: dto.rating,
        comment: dto.comment,
        productId: dto.productId ?? null,
        isPublished: dto.isPublished ?? false,
      },
      include,
    });
    return toDto(row);
  }

  async update(id: string, dto: UpdateTestimonialDto): Promise<TestimonialDto> {
    await this.assertProduct(dto.productId);
    const exists = await this.prisma.testimonial.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('El testimonio no existe.');
    const row = await this.prisma.testimonial.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastInitial: dto.lastInitial,
        rating: dto.rating,
        comment: dto.comment,
        productId: dto.productId,
        isPublished: dto.isPublished,
      },
      include,
    });
    return toDto(row);
  }

  async remove(id: string): Promise<void> {
    const { count } = await this.prisma.testimonial.deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundException('El testimonio no existe.');
  }

  private async assertProduct(productId: string | null | undefined): Promise<void> {
    if (!productId) return;
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new BadRequestException('El producto indicado no existe.');
  }
}
