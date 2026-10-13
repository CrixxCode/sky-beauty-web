import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountType, Prisma, PromotionScope } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';
import type {
  CreatePromotionDto,
  ListPromotionsQueryDto,
  PaginatedPromotionsDto,
  PromotionDto,
  PromotionRevisionDto,
  UpdatePromotionDto,
} from './promotions.dto';

type PromotionWithTargets = Prisma.PromotionGetPayload<{
  include: {
    variants: true;
    products: true;
    categories: true;
    _count: { select: { revisions: true } };
  };
}>;

type PromotionRevisionRecord = Prisma.PromotionRevisionGetPayload<Record<string, never>>;

function uniqueIds(ids: string[] | undefined): string[] {
  return [...new Set(ids ?? [])];
}

function targetIds(dto: CreatePromotionDto | UpdatePromotionDto) {
  return {
    variantIds: dto.scope === PromotionScope.VARIANT ? uniqueIds(dto.variantIds) : [],
    productIds: dto.scope === PromotionScope.PRODUCT ? uniqueIds(dto.productIds) : [],
    categoryIds: dto.scope === PromotionScope.CATEGORY ? uniqueIds(dto.categoryIds) : [],
  };
}

function toDto(promotion: PromotionWithTargets): PromotionDto {
  return {
    id: promotion.id,
    name: promotion.name,
    description: promotion.description,
    discountType: promotion.discountType,
    discountValue: promotion.discountValue.toNumber(),
    scope: promotion.scope,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    isActive: promotion.isActive,
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
    variantIds: promotion.variants.map((target) => target.variantId),
    productIds: promotion.products.map((target) => target.productId),
    categoryIds: promotion.categories.map((target) => target.categoryId),
    revisionCount: promotion._count.revisions,
  };
}

function toRevisionDto(revision: PromotionRevisionRecord): PromotionRevisionDto {
  return {
    id: revision.id,
    promotionId: revision.promotionId,
    revision: revision.revision,
    validFrom: revision.validFrom,
    name: revision.name,
    discountType: revision.discountType,
    discountValue: revision.discountValue.toNumber(),
    scope: revision.scope,
    startsAt: revision.startsAt,
    endsAt: revision.endsAt,
    isActive: revision.isActive,
    variantIds: revision.variantIds,
    productIds: revision.productIds,
    categoryIds: revision.categoryIds,
    changedById: revision.changedById,
  };
}

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: StoreSettingsService,
  ) {}

  async list(query: ListPromotionsQueryDto): Promise<PaginatedPromotionsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.PromotionWhereInput = {};

    if (query.scope) where.scope = query.scope;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.q?.trim()) where.name = { contains: query.q.trim(), mode: 'insensitive' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.promotion.findMany({
        where,
        include: this.includeTargets(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return { items: items.map(toDto), total };
  }

  async findOne(id: string): Promise<PromotionDto> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: this.includeTargets(),
    });
    if (!promotion) throw new NotFoundException(`Promocion con id '${id}' no encontrada.`);
    return toDto(promotion);
  }

  async revisions(id: string): Promise<PromotionRevisionDto[]> {
    await this.ensureExists(id);
    const revisions = await this.prisma.promotionRevision.findMany({
      where: { promotionId: id },
      orderBy: { revision: 'desc' },
    });
    return revisions.map(toRevisionDto);
  }

  async create(dto: CreatePromotionDto, adminId: string): Promise<PromotionDto> {
    const targets = targetIds(dto);
    await this.validatePayload(dto, targets);

    const promotion = await this.prisma.$transaction(async (tx) => {
      const created = await tx.promotion.create({
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          scope: dto.scope,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          isActive: dto.isActive ?? true,
          variants: { create: targets.variantIds.map((variantId) => ({ variantId })) },
          products: { create: targets.productIds.map((productId) => ({ productId })) },
          categories: { create: targets.categoryIds.map((categoryId) => ({ categoryId })) },
        },
      });
      await this.createRevision(tx, created.id, 1, dto, targets, adminId);
      return tx.promotion.findUniqueOrThrow({
        where: { id: created.id },
        include: this.includeTargets(),
      });
    });

    return toDto(promotion);
  }

  async update(id: string, dto: UpdatePromotionDto, adminId: string): Promise<PromotionDto> {
    const existing = await this.prisma.promotion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Promocion con id '${id}' no encontrada.`);

    const targets = targetIds(dto);
    await this.validatePayload(dto, targets);

    const promotion = await this.prisma.$transaction(async (tx) => {
      // Bloqueo optimista: si otra edición guardó entretanto, esta se rechaza en lugar de
      // pisarla o chocar con el número de versión.
      const { count } = await tx.promotion.updateMany({
        where: { id, updatedAt: existing.updatedAt },
        data: { updatedAt: new Date() },
      });
      if (count !== 1) {
        throw new ConflictException(
          'La promoción cambió mientras la editabas. Vuelve a cargarla e inténtalo de nuevo.',
        );
      }
      await tx.promotionVariant.deleteMany({ where: { promotionId: id } });
      await tx.promotionProduct.deleteMany({ where: { promotionId: id } });
      await tx.promotionCategory.deleteMany({ where: { promotionId: id } });

      const updated = await tx.promotion.update({
        where: { id },
        data: {
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          scope: dto.scope,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          isActive: dto.isActive ?? true,
          variants: { create: targets.variantIds.map((variantId) => ({ variantId })) },
          products: { create: targets.productIds.map((productId) => ({ productId })) },
          categories: { create: targets.categoryIds.map((categoryId) => ({ categoryId })) },
        },
      });

      const latest = await tx.promotionRevision.findFirst({
        where: { promotionId: id },
        orderBy: { revision: 'desc' },
      });
      await this.createRevision(tx, id, (latest?.revision ?? 0) + 1, dto, targets, adminId);
      return tx.promotion.findUniqueOrThrow({
        where: { id: updated.id },
        include: this.includeTargets(),
      });
    });

    return toDto(promotion);
  }

  private includeTargets() {
    return {
      variants: true,
      products: true,
      categories: true,
      _count: { select: { revisions: true } },
    } satisfies Prisma.PromotionInclude;
  }

  private async ensureExists(id: string): Promise<void> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!promotion) throw new NotFoundException(`Promocion con id '${id}' no encontrada.`);
  }

  private async validatePayload(
    dto: CreatePromotionDto | UpdatePromotionDto,
    targets: ReturnType<typeof targetIds>,
  ): Promise<void> {
    if (dto.startsAt >= dto.endsAt) {
      throw new BadRequestException('La fecha de inicio debe ser anterior a la fecha de fin.');
    }

    if (dto.discountType === DiscountType.PERCENTAGE) {
      const settings = await this.settings.get();
      const max = settings.maxPercentageDiscount ?? 100;
      if (dto.discountValue > max) {
        throw new BadRequestException(`El descuento porcentual no puede superar ${max}%.`);
      }
    }

    const selectedTargetCount =
      targets.variantIds.length + targets.productIds.length + targets.categoryIds.length;
    if (selectedTargetCount === 0) {
      throw new BadRequestException('La promocion debe tener al menos un destino.');
    }

    await this.validateTargets(targets);
  }

  private async validateTargets(targets: ReturnType<typeof targetIds>): Promise<void> {
    const [variantCount, productCount, categoryCount] = await Promise.all([
      targets.variantIds.length
        ? this.prisma.productVariant.count({ where: { id: { in: targets.variantIds } } })
        : 0,
      targets.productIds.length
        ? this.prisma.product.count({ where: { id: { in: targets.productIds } } })
        : 0,
      targets.categoryIds.length
        ? this.prisma.category.count({ where: { id: { in: targets.categoryIds } } })
        : 0,
    ]);

    if (variantCount !== targets.variantIds.length) {
      throw new BadRequestException('Una o mas variantes seleccionadas no existen.');
    }
    if (productCount !== targets.productIds.length) {
      throw new BadRequestException('Uno o mas productos seleccionados no existen.');
    }
    if (categoryCount !== targets.categoryIds.length) {
      throw new BadRequestException('Una o mas categorias seleccionadas no existen.');
    }
  }

  private createRevision(
    tx: Prisma.TransactionClient,
    promotionId: string,
    revision: number,
    dto: CreatePromotionDto | UpdatePromotionDto,
    targets: ReturnType<typeof targetIds>,
    adminId: string,
  ) {
    return tx.promotionRevision.create({
      data: {
        promotionId,
        revision,
        name: dto.name.trim(),
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        scope: dto.scope,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        isActive: dto.isActive ?? true,
        variantIds: targets.variantIds,
        productIds: targets.productIds,
        categoryIds: targets.categoryIds,
        changedById: adminId,
      },
    });
  }
}
