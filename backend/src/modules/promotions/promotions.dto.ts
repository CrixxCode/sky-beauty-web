import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DiscountType, PromotionScope } from '../../generated/prisma/client';

export class ListPromotionsQueryDto {
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

  @ApiPropertyOptional({ enum: PromotionScope })
  @IsOptional()
  @IsEnum(PromotionScope)
  scope?: PromotionScope;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Busqueda por nombre.' })
  @IsOptional()
  @IsString()
  q?: string;
}

export class PromotionPayloadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ maxLength: 400 })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  description?: string | null;

  @ApiProperty({ enum: DiscountType })
  @IsEnum(DiscountType)
  discountType!: DiscountType;

  @ApiProperty({ minimum: 0.01 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  discountValue!: number;

  @ApiProperty({ enum: PromotionScope })
  @IsEnum(PromotionScope)
  scope!: PromotionScope;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: String, isArray: true })
  @ValidateIf((dto: PromotionPayloadDto) => dto.scope === PromotionScope.VARIANT)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  variantIds?: string[];

  @ApiPropertyOptional({ type: String, isArray: true })
  @ValidateIf((dto: PromotionPayloadDto) => dto.scope === PromotionScope.PRODUCT)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({ type: String, isArray: true })
  @ValidateIf((dto: PromotionPayloadDto) => dto.scope === PromotionScope.CATEGORY)
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  categoryIds?: string[];
}

export class CreatePromotionDto extends PromotionPayloadDto {}

export class UpdatePromotionDto extends PromotionPayloadDto {}

export class PromotionRevisionDto {
  @ApiProperty() id!: string;
  @ApiProperty() promotionId!: string;
  @ApiProperty() revision!: number;
  @ApiProperty() validFrom!: Date;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: DiscountType }) discountType!: DiscountType;
  @ApiProperty() discountValue!: number;
  @ApiProperty({ enum: PromotionScope }) scope!: PromotionScope;
  @ApiProperty() startsAt!: Date;
  @ApiProperty() endsAt!: Date;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: String, isArray: true }) variantIds!: string[];
  @ApiProperty({ type: String, isArray: true }) productIds!: string[];
  @ApiProperty({ type: String, isArray: true }) categoryIds!: string[];
  @ApiProperty({ nullable: true, type: String }) changedById!: string | null;
}

export class PromotionDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ enum: DiscountType }) discountType!: DiscountType;
  @ApiProperty() discountValue!: number;
  @ApiProperty({ enum: PromotionScope }) scope!: PromotionScope;
  @ApiProperty() startsAt!: Date;
  @ApiProperty() endsAt!: Date;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ type: String, isArray: true }) variantIds!: string[];
  @ApiProperty({ type: String, isArray: true }) productIds!: string[];
  @ApiProperty({ type: String, isArray: true }) categoryIds!: string[];
  @ApiProperty() revisionCount!: number;
}

export class PaginatedPromotionsDto {
  @ApiProperty({ type: () => PromotionDto, isArray: true }) items!: PromotionDto[];
  @ApiProperty() total!: number;
}
