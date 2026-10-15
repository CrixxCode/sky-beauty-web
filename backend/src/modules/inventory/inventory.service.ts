import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryMovementType, Prisma } from '../../generated/prisma/client';
import { uploadUrl } from '../../shared/uploads';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type {
  CreateInventoryMovementDto,
  InventoryMovementDto,
  InventoryVariantDto,
  ListInventoryMovementsQueryDto,
  ListInventoryQueryDto,
  PaginatedInventoryMovementsDto,
} from './inventory.dto';

/** Tipos de movimiento que se registran a mano desde el inventario. Los de pedidos los crea el módulo de pedidos. */
const MANUAL_TYPES: InventoryMovementType[] = [
  InventoryMovementType.INITIAL,
  InventoryMovementType.PURCHASE,
  InventoryMovementType.ADJUSTMENT,
];

const movementInclude = {
  variant: { select: { name: true, sku: true, product: { select: { name: true } } } },
  createdBy: { select: { name: true } },
} satisfies Prisma.InventoryMovementInclude;

type MovementWithRelations = Prisma.InventoryMovementGetPayload<{
  include: typeof movementInclude;
}>;

function movementDto(movement: MovementWithRelations): InventoryMovementDto {
  return {
    id: movement.id,
    variantId: movement.variantId,
    type: movement.type,
    quantity: movement.quantity,
    stockBefore: movement.stockBefore,
    stockAfter: movement.stockAfter,
    reason: movement.reason,
    orderId: movement.orderId,
    createdById: movement.createdById,
    createdByName: movement.createdBy?.name ?? null,
    productName: movement.variant.product.name,
    variantName: movement.variant.name,
    sku: movement.variant.sku,
    createdAt: movement.createdAt,
  };
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listVariants(query: ListInventoryQueryDto): Promise<InventoryVariantDto[]> {
    const q = query.q?.trim();
    const variants = await this.prisma.productVariant.findMany({
      where: q
        ? {
            OR: [
              { sku: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { product: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            images: { where: { variantId: null }, orderBy: { position: 'asc' }, take: 1 },
          },
        },
        images: { orderBy: { position: 'asc' }, take: 1 },
      },
      orderBy: [{ product: { name: 'asc' } }, { position: 'asc' }],
    });

    return variants
      .map((variant) => ({
        variantId: variant.id,
        productId: variant.productId,
        productName: variant.product.name,
        variantName: variant.name,
        sku: variant.sku,
        stock: variant.stock,
        lowStockThreshold: variant.lowStockThreshold,
        isLowStock:
          variant.lowStockThreshold !== null && variant.stock <= variant.lowStockThreshold,
        isActive: variant.isActive,
        thumbnailUrl: (() => {
          const image = variant.images[0] ?? variant.product.images[0];
          return image ? uploadUrl(image.thumbnailKey) : null;
        })(),
      }))
      .filter((variant) => !query.lowStock || variant.isLowStock);
  }

  async listMovements(
    query: ListInventoryMovementsQueryDto,
  ): Promise<PaginatedInventoryMovementsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const skip = (page - 1) * limit;
    const where: Prisma.InventoryMovementWhereInput = query.variantId
      ? { variantId: query.variantId }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryMovement.findMany({
        where,
        include: movementInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return { items: items.map(movementDto), total };
  }

  async createMovement(
    dto: CreateInventoryMovementDto,
    adminId: string,
  ): Promise<InventoryMovementDto> {
    const reason = dto.reason?.trim() ?? '';

    if (!MANUAL_TYPES.includes(dto.type)) {
      throw new BadRequestException('Este tipo de movimiento no se registra desde inventario.');
    }
    if (dto.type === InventoryMovementType.ADJUSTMENT && !reason) {
      throw new BadRequestException('La justificación del ajuste es obligatoria.');
    }
    if (dto.type !== InventoryMovementType.ADJUSTMENT && dto.quantity <= 0) {
      throw new BadRequestException(
        'Las entradas iniciales y compras deben tener cantidad positiva.',
      );
    }
    if (dto.quantity === 0) {
      throw new BadRequestException('El ajuste debe aumentar o disminuir existencias.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Bloquea la fila de la variante hasta el final de la transacción: los movimientos de una
      // misma variante se procesan de a uno. Sin esto, dos "existencias iniciales" simultáneas
      // contaban cero movimientos y ambas se registraban.
      const [variant] = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "ProductVariant" WHERE id = ${dto.variantId}::uuid FOR UPDATE`;
      if (!variant) {
        throw new NotFoundException(`Variante con id '${dto.variantId}' no encontrada.`);
      }

      if (dto.type === InventoryMovementType.INITIAL) {
        const existingMovements = await tx.inventoryMovement.count({
          where: { variantId: dto.variantId },
        });
        if (existingMovements > 0) {
          throw new ConflictException(
            'Las existencias iniciales solo se pueden registrar antes de cualquier otro movimiento.',
          );
        }
      }

      // Incremento atómico: dos movimientos simultáneos no se pisan, y una salida solo se aplica
      // si hay existencias suficientes en ese momento.
      const { count } = await tx.productVariant.updateMany({
        where: {
          id: dto.variantId,
          ...(dto.quantity < 0 && { stock: { gte: -dto.quantity } }),
        },
        data: { stock: { increment: dto.quantity } },
      });
      if (count === 0) {
        throw new BadRequestException('El movimiento no puede dejar existencias negativas.');
      }

      const { stock: stockAfter } = await tx.productVariant.findUniqueOrThrow({
        where: { id: dto.variantId },
        select: { stock: true },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          variantId: dto.variantId,
          type: dto.type,
          quantity: dto.quantity,
          stockBefore: stockAfter - dto.quantity,
          stockAfter,
          reason,
          createdById: adminId,
        },
        include: movementInclude,
      });

      return movementDto(movement);
    });
  }
}
