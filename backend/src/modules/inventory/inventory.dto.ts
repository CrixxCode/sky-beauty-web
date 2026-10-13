import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { InventoryMovementType } from '../../generated/prisma/client';

export class ListInventoryQueryDto {
  @ApiPropertyOptional({ description: 'Solo variantes con stock bajo configurado y alcanzado.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  lowStock?: boolean;

  @ApiPropertyOptional({ description: 'Búsqueda por producto, variante o SKU.' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class ListInventoryMovementsQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 30, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}

export class CreateInventoryMovementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  variantId!: string;

  @ApiProperty({
    enum: [
      InventoryMovementType.INITIAL,
      InventoryMovementType.PURCHASE,
      InventoryMovementType.ADJUSTMENT,
    ],
  })
  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @ApiProperty({ description: 'Entradas positivas. Ajustes pueden ser positivos o negativos.' })
  @IsInt()
  quantity!: number;

  @ApiPropertyOptional({
    maxLength: 300,
    description: 'Justificación. Obligatoria en los ajustes; opcional en entradas.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class InventoryVariantDto {
  @ApiProperty() variantId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() stock!: number;
  @ApiProperty({ nullable: true, type: Number }) lowStockThreshold!: number | null;
  @ApiProperty() isLowStock!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ nullable: true, type: String }) thumbnailUrl!: string | null;
}

export class InventoryMovementDto {
  @ApiProperty() id!: string;
  @ApiProperty() variantId!: string;
  @ApiProperty({ enum: InventoryMovementType }) type!: InventoryMovementType;
  @ApiProperty() quantity!: number;
  @ApiProperty() stockBefore!: number;
  @ApiProperty() stockAfter!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({ nullable: true, type: String }) orderId!: string | null;
  @ApiProperty({ nullable: true, type: String }) createdById!: string | null;
  @ApiProperty({ nullable: true, type: String }) createdByName!: string | null;
  @ApiProperty() productName!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() createdAt!: Date;
}

export class PaginatedInventoryMovementsDto {
  @ApiProperty({ type: () => InventoryMovementDto, isArray: true }) items!: InventoryMovementDto[];
  @ApiProperty() total!: number;
}
