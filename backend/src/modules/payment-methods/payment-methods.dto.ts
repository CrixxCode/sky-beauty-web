import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class UpdatePaymentMethodDto {
  @ApiPropertyOptional({ nullable: true, description: 'Instrucciones visibles para el cliente.' })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(2000)
  instructions?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Total máximo del pedido (COP). Solo para métodos restringidos por municipio.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ingresa un valor en pesos.' })
  @Min(0)
  @Max(9_999_999_999.99)
  maxOrderTotal?: number | null;
}

export class SetPaymentMethodCitiesDto {
  @ApiProperty({ type: [String], example: ['05001', '11001'] })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(1200)
  @Matches(/^\d{5}$/, { each: true, message: 'Código de municipio inválido.' })
  municipalityCodes!: string[];
}

export class PaymentMethodCityDto {
  @ApiProperty() municipalityCode!: string;
  @ApiProperty() municipalityName!: string;
  @ApiProperty() departmentName!: string;
}

export class PaymentMethodDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) instructions!: string | null;
  @ApiProperty() requiresVerification!: boolean;
  @ApiProperty() restrictToCities!: boolean;
  @ApiProperty({ nullable: true, type: Number }) maxOrderTotal!: number | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: [PaymentMethodCityDto] }) cities!: PaymentMethodCityDto[];
}
