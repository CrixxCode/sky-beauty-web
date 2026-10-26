import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MAX_MONEY = 9_999_999_999.99;

export class CarrierDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) trackingUrlTemplate!: string | null;
  @ApiProperty({ nullable: true, type: String }) phone!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class CreateCarrierDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'URL opcional con el marcador {tracking}.' })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/\S+$/)
  @MaxLength(500)
  trackingUrlTemplate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCarrierDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ nullable: true, description: 'URL opcional con el marcador {tracking}.' })
  @IsOptional()
  @IsString()
  @Matches(/^https?:\/\/\S+$/)
  @MaxLength(500)
  trackingUrlTemplate?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CarrierRateDto {
  @ApiProperty() id!: string;
  @ApiProperty() carrierId!: string;
  @ApiProperty() municipalityCode!: string;
  @ApiProperty() municipalityName!: string;
  @ApiProperty() departmentName!: string;
  @ApiProperty({ type: Number }) amount!: number;
}

export class UpsertCarrierRateDto {
  @ApiProperty({ example: '44001' })
  @Matches(/^\d{5}$/, { message: 'Código de municipio inválido.' })
  municipalityCode!: string;

  @ApiProperty({ example: 8000, description: 'Lo que se le cobra al cliente por el envío.' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ingresa un valor en pesos.' })
  @Min(0)
  @Max(MAX_MONEY)
  amount!: number;
}
