import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { BrandDto, CreateBrandDto, PublicBrandDto, UpdateBrandDto } from './brands.dto';

/** Genera un slug a partir de un texto (minúsculas, sin acentos, guiones). */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

type BrandWithCount = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { products: number };
};

function toDto(brand: BrandWithCount): BrandDto {
  return {
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    isActive: brand.isActive,
    productCount: brand._count.products,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
  };
}

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<BrandDto[]> {
    const brands = await this.prisma.brand.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    return brands.map(toDto);
  }

  async listPublic(): Promise<PublicBrandDto[]> {
    const brands = await this.prisma.brand.findMany({
      where: {
        isActive: true,
        products: {
          some: { status: 'ACTIVE' },
        },
      },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    });
    return brands;
  }

  async create(dto: CreateBrandDto): Promise<BrandDto> {
    const slug = dto.slug ?? slugify(dto.name);
    try {
      const brand = await this.prisma.brand.create({
        data: { name: dto.name, slug },
        include: { _count: { select: { products: true } } },
      });
      return toDto(brand);
    } catch (err: unknown) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException('Ya existe una marca con ese nombre o slug.');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandDto> {
    await this.findOrThrow(id);
    const slug =
      dto.slug !== undefined
        ? dto.slug
        : dto.name !== undefined
          ? slugify(dto.name)
          : undefined;
    try {
      const brand = await this.prisma.brand.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(slug !== undefined && { slug }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        include: { _count: { select: { products: true } } },
      });
      return toDto(brand);
    } catch (err: unknown) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException('Ya existe una marca con ese nombre o slug.');
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    const productCount = await this.prisma.product.count({ where: { brandId: id } });
    if (productCount > 0) {
      throw new ConflictException(
        'No se puede eliminar la marca porque tiene productos asociados.',
      );
    }
    await this.prisma.brand.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException(`Marca con id '${id}' no encontrada.`);
    return brand;
  }
}

function isPrismaUniqueError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}
