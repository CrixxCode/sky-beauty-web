import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  CategoryDto,
  CreateCategoryDto,
  PublicCategoryDto,
  UpdateCategoryDto,
} from './categories.dto';

/** Genera un slug a partir de un texto. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isPrismaUniqueError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}

type CategoryWithChildren = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string | null;
  imageUrl: string | null;
  position: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  children: CategoryWithChildren[];
};

function toCategoryDto(cat: CategoryWithChildren): CategoryDto {
  return {
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    parentId: cat.parentId,
    description: cat.description,
    imageUrl: cat.imageUrl,
    position: cat.position,
    isActive: cat.isActive,
    children: cat.children.map(toCategoryDto),
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  };
}

const categoryInclude = {
  children: {
    include: {
      children: true,
    },
    orderBy: { position: 'asc' as const },
  },
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Árbol completo de categorías raíz con sus hijos. */
  async tree(): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { parentId: null },
      include: categoryInclude,
      orderBy: { position: 'asc' },
    });
    return categories.map(toCategoryDto);
  }

  /** Árbol público: solo categorías raíz activas con hijos activos que tengan al menos un producto ACTIVE. */
  async publicTree(): Promise<PublicCategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        parentId: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        children: {
          where: {
            isActive: true,
            products: { some: { status: 'ACTIVE' } },
          },
          select: {
            id: true,
            name: true,
            slug: true,
            parentId: true,
          },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { position: 'asc' },
    });

    // Filtrar categorías raíz que tienen hijos activos con productos, o que ellas mismas tienen productos ACTIVE directos
    const result: PublicCategoryDto[] = [];
    for (const cat of categories) {
      const hasDirectProducts =
        (await this.prisma.product.count({
          where: { categoryId: cat.id, status: 'ACTIVE' },
        })) > 0;
      if (cat.children.length > 0 || hasDirectProducts) {
        result.push({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          parentId: cat.parentId,
          children: cat.children.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            parentId: c.parentId,
            children: [],
          })),
        });
      }
    }
    return result;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    // Validar máximo 2 niveles: si parentId tiene a su vez parentId, rechazar
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Categoría padre con id '${dto.parentId}' no encontrada.`);
      }
      if (parent.parentId !== null) {
        throw new BadRequestException(
          'No se permite más de dos niveles de categorías (categoría > subcategoría).',
        );
      }
    }

    const slug = dto.slug ?? slugify(dto.name);
    try {
      const cat = await this.prisma.category.create({
        data: {
          name: dto.name,
          slug,
          parentId: dto.parentId ?? null,
          description: dto.description ?? null,
          position: dto.position ?? 0,
          isActive: dto.isActive ?? true,
        },
        include: categoryInclude,
      });
      return toCategoryDto(cat as CategoryWithChildren);
    } catch (err: unknown) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException('Ya existe una categoría con ese slug.');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    await this.findOrThrow(id);
    const slug =
      dto.slug !== undefined
        ? dto.slug
        : dto.name !== undefined
          ? slugify(dto.name)
          : undefined;
    try {
      const cat = await this.prisma.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(slug !== undefined && { slug }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.position !== undefined && { position: dto.position }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        include: categoryInclude,
      });
      return toCategoryDto(cat as CategoryWithChildren);
    } catch (err: unknown) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException('Ya existe una categoría con ese slug.');
      }
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    const childCount = await this.prisma.category.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new ConflictException(
        'No se puede eliminar la categoría porque tiene subcategorías.',
      );
    }
    const productCount = await this.prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      throw new ConflictException(
        'No se puede eliminar la categoría porque tiene productos asociados.',
      );
    }
    await this.prisma.category.delete({ where: { id } });
  }

  private async findOrThrow(id: string) {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException(`Categoría con id '${id}' no encontrada.`);
    return cat;
  }
}
