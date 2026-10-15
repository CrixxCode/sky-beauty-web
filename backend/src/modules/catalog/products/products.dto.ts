import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ProductStatus } from '../../../generated/prisma/client';
import { DiscountType, PromotionScope } from '../../../generated/prisma/client';

// ─────────────────────────────── Productos ───────────────────────────────────

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Si no se indica, se genera del nombre.' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  slug?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ format: 'uuid', description: 'Marca (obligatoria).' })
  @IsUUID()
  brandId!: string;

  @ApiPropertyOptional({ maxLength: 50, description: 'Ej: "30 ml", "4 g".' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  netContent?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ minimum: 0, exclusiveMinimum: true, description: 'Precio base en COP.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio debe ser mayor que 0.' })
  basePrice!: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(220)
  slug?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  netContent?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ minimum: 0, exclusiveMinimum: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio debe ser mayor que 0.' })
  basePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class ChangeProductStatusDto {
  @ApiProperty({ enum: ProductStatus })
  @IsEnum(ProductStatus)
  status!: ProductStatus;
}

export class UploadProductImageDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Variante propietaria de la foto. Vacío = foto general.',
  })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  alt?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

// ─────────────────────────────── Variantes ───────────────────────────────────

export class CreateVariantDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sku!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: 'Color de muestra en formato hex, ej: #FF00AA.' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'colorHex debe tener formato #RRGGBB.' })
  colorHex?: string;

  @ApiPropertyOptional({
    minimum: 0,
    exclusiveMinimum: true,
    description: 'Precio propio de la variante en COP. null = usa el basePrice del producto.',
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio debe ser mayor que 0.' })
  price?: number | null;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Costo de compra en COP. Solo visible para ADMIN.',
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number | null;

  @ApiPropertyOptional({
    minimum: 1,
    description: 'Máximo de unidades por pedido. null = sin límite.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerOrder?: number;

  @ApiPropertyOptional({ minimum: 0, description: 'Umbral de stock bajo. null = sin alerta.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;
}

export class UpdateVariantDto {
  /** sku no se puede cambiar una vez creada la variante. */

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'colorHex debe tener formato #RRGGBB.' })
  colorHex?: string | null;

  @ApiPropertyOptional({ minimum: 0, exclusiveMinimum: true, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El precio debe ser mayor que 0.' })
  price?: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true, description: 'Solo ADMIN.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice?: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPerOrder?: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─────────────────────────────── Respuesta ───────────────────────────────────

export class ImageDto {
  @ApiProperty() id!: string;
  @ApiProperty() productId!: string;
  @ApiProperty({ nullable: true, type: String }) variantId!: string | null;
  @ApiProperty() storageKey!: string;
  @ApiProperty() url!: string;
  @ApiProperty() thumbnailKey!: string;
  @ApiProperty() thumbnailUrl!: string;
  @ApiProperty() alt!: string;
  @ApiProperty() width!: number;
  @ApiProperty() height!: number;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() mimeType!: string;
  @ApiProperty() position!: number;
  @ApiProperty() createdAt!: Date;
}

export class VariantDto {
  @ApiProperty() id!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) colorHex!: string | null;
  @ApiProperty({ nullable: true, type: Number }) price!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number, description: 'Solo ADMIN.' })
  costPrice?: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxPerOrder!: number | null;
  @ApiProperty() stock!: number;
  @ApiProperty({ nullable: true, type: Number }) lowStockThreshold!: number | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() position!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: () => ImageDto, isArray: true }) images!: ImageDto[];
}

export class ProductDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ nullable: true, type: String }) shortDescription!: string | null;
  @ApiProperty() description!: string;
  @ApiProperty() brandId!: string;
  @ApiProperty({ nullable: true, type: String }) netContent!: string | null;
  @ApiProperty() categoryId!: string;
  @ApiProperty() basePrice!: number;
  @ApiProperty({ enum: ProductStatus }) status!: ProductStatus;
  @ApiProperty() isFeatured!: boolean;
  @ApiProperty({ nullable: true, type: Date }) publishedAt!: Date | null;
  @ApiProperty({ nullable: true, type: Date }) archivedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: () => VariantDto, isArray: true }) variants!: VariantDto[];
  @ApiProperty({ type: () => ImageDto, isArray: true }) images!: ImageDto[];
}

/** Campos reducidos para el listado de productos en el panel. */
export class ProductListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ nullable: true, type: String }) shortDescription!: string | null;
  @ApiProperty() brandId!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty() basePrice!: number;
  @ApiProperty({ enum: ProductStatus }) status!: ProductStatus;
  @ApiProperty() isFeatured!: boolean;
  @ApiProperty({ nullable: true, type: Date }) publishedAt!: Date | null;
  @ApiProperty({ nullable: true, type: Date }) archivedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty() variantCount!: number;
}

// ─────────────────────────────── Tienda pública ───────────────────────────────

export class PublicVariantDto {
  @ApiProperty() id!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) colorHex!: string | null;
  @ApiProperty({ nullable: true, type: Number }) price!: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxPerOrder!: number | null;
  @ApiProperty({ description: 'Existencias disponibles.' }) stock!: number;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() position!: number;
  @ApiProperty({ type: () => ImageDto, isArray: true }) images!: ImageDto[];
  @ApiProperty() regularPrice!: number;
  @ApiProperty() discountAmount!: number;
  @ApiProperty() finalPrice!: number;
  @ApiProperty({ nullable: true, type: String }) promotionId!: string | null;
  @ApiProperty({ nullable: true, type: String }) promotionName!: string | null;
  @ApiProperty({ nullable: true, enum: PromotionScope }) promotionScope!: PromotionScope | null;
  @ApiProperty({ nullable: true, enum: DiscountType }) discountType!: DiscountType | null;
  @ApiProperty({ nullable: true, type: Number }) discountValue!: number | null;
}

export class PublicProductDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ nullable: true, type: String }) shortDescription!: string | null;
  @ApiProperty() description!: string;
  @ApiProperty() brandId!: string;
  @ApiProperty({ nullable: true, type: String }) netContent!: string | null;
  @ApiProperty() categoryId!: string;
  @ApiProperty() basePrice!: number;
  @ApiProperty() isFeatured!: boolean;
  @ApiProperty({ nullable: true, type: Date }) publishedAt!: Date | null;
  @ApiProperty({ type: () => PublicVariantDto, isArray: true }) variants!: PublicVariantDto[];
  @ApiProperty({ type: () => ImageDto, isArray: true }) images!: ImageDto[];
  @ApiProperty({ description: 'Precio regular de la variante con menor precio final.' })
  regularPriceFrom!: number;
  @ApiProperty({ description: 'Menor precio final entre las variantes activas.' })
  finalPriceFrom!: number;
  @ApiProperty() hasDiscount!: boolean;
}

// ─────────────────────────────── Queries ─────────────────────────────────────

export class ListProductsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre.' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class PublicListProductsQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por nombre.' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Solo productos destacados.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({
    description:
      'Solo productos con alguna variante en promoción vigente (ordenados por descuento).',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  onSale?: boolean;

  @ApiPropertyOptional({
    description:
      'Ids de productos separados por coma (p. ej. los favoritos guardados en el navegador).',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : value,
  )
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids?: string[];
}

// ─────────────────────────────── Paginación ──────────────────────────────────

export class PaginatedProductsDto {
  @ApiProperty({ type: () => ProductListItemDto, isArray: true }) items!: ProductListItemDto[];
  @ApiProperty() total!: number;
}

export class PaginatedPublicProductsDto {
  @ApiProperty({ type: () => PublicProductDto, isArray: true }) items!: PublicProductDto[];
  @ApiProperty() total!: number;
}
