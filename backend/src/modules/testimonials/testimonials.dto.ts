import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** La inicial se guarda en mayúscula y sin punto ("g." → "G"). */
const initial = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\.$/, '').toLocaleUpperCase('es-CO') : value;
const LETTER = /^\p{L}$/u;
const LETTER_MESSAGE = 'La inicial del apellido debe ser una sola letra.';

export class CreateTestimonialDto {
  @ApiProperty({ maxLength: 60, description: 'Nombre de la clienta (solo el nombre).' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ description: 'Primera letra del apellido.', example: 'G' })
  @Transform(initial)
  @IsString()
  @Matches(LETTER, { message: LETTER_MESSAGE })
  lastInitial!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ maxLength: 600 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(600)
  comment!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Producto que compró.' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  productId?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateTestimonialDto {
  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(initial)
  @IsString()
  @Matches(LETTER, { message: LETTER_MESSAGE })
  lastInitial?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ maxLength: 600 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(600)
  comment?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  productId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class TestimonialDto {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastInitial!: string;
  @ApiProperty() rating!: number;
  @ApiProperty() comment!: string;
  @ApiProperty({ nullable: true, type: String }) productId!: string | null;
  @ApiProperty({ nullable: true, type: String }) productName!: string | null;
  @ApiProperty() isPublished!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class PublicTestimonialProductDto {
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
}

/** Testimonio publicado: nombre con la inicial del apellido ("María G."). */
export class PublicTestimonialDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'María G.' }) authorName!: string;
  @ApiProperty() rating!: number;
  @ApiProperty() comment!: string;
  @ApiProperty({
    type: PublicTestimonialProductDto,
    nullable: true,
    description: 'Solo si el producto sigue publicado en la tienda.',
  })
  product!: PublicTestimonialProductDto | null;
}
