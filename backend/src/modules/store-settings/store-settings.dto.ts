import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { normalizeWhatsappNumber, WHATSAPP_NUMBER_PATTERN } from '../../shared/phone';

/** Recorta textos y convierte cadenas vacías en null (null borra el valor). */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const MAX_MONEY = 9_999_999_999.99;
const urlOptions = { protocols: ['http', 'https'], require_protocol: true };
const urlMessage = 'Ingresa una dirección web completa (https://…).';

/**
 * Campos editables de la configuración en el módulo 2. Todos son opcionales; enviar null borra el valor.
 * Los textos del inicio, el anuncio y los textos legales se gestionan en el módulo de contenido.
 */
export class UpdateStoreSettingsDto {
  @ApiPropertyOptional({ nullable: true, example: '573001234567' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const v = trimToNull({ value });
    return typeof v === 'string' ? normalizeWhatsappNumber(v) : v;
  })
  @Matches(WHATSAPP_NUMBER_PATTERN, {
    message: 'Ingresa un número de WhatsApp válido, por ejemplo 300 123 4567.',
  })
  whatsappNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const v = trimToNull({ value });
    return typeof v === 'string' ? v.toLowerCase() : v;
  })
  @IsEmail({}, { message: 'Ingresa un correo válido.' })
  contactEmail?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(30)
  contactPhone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(200)
  addressText?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(200)
  businessHours?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsUrl(urlOptions, { message: urlMessage })
  @MaxLength(300)
  instagramUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsUrl(urlOptions, { message: urlMessage })
  @MaxLength(300)
  facebookUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimToNull)
  @IsUrl(urlOptions, { message: urlMessage })
  @MaxLength(300)
  tiktokUrl?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'COP, después de descuentos. null = sin envío gratis.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ingresa un valor en pesos.' })
  @Min(0)
  @Max(MAX_MONEY)
  freeShippingThreshold?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt({ message: 'Ingresa un número entero de unidades.' })
  @Min(0)
  @Max(100_000)
  defaultLowStockThreshold?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Porcentaje máximo (mayor que 0 y hasta 100).',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ingresa un porcentaje.' })
  @Min(0.01, { message: 'El límite debe ser mayor que 0.' })
  @Max(100, { message: 'El límite no puede superar el 100 %.' })
  maxPercentageDiscount?: number | null;

  @ApiPropertyOptional({
    description: 'Campaña temporal: envío gratis a cualquier municipio mientras esté activo.',
  })
  @IsOptional()
  @IsBoolean()
  nationalFreeShipping?: boolean;
}

export class StoreSettingsDto {
  @ApiProperty() storeName!: string;
  @ApiProperty({ nullable: true, type: String }) whatsappNumber!: string | null;
  @ApiProperty({ nullable: true, type: String }) contactEmail!: string | null;
  @ApiProperty({ nullable: true, type: String }) contactPhone!: string | null;
  @ApiProperty({ nullable: true, type: String }) addressText!: string | null;
  @ApiProperty({ nullable: true, type: String }) businessHours!: string | null;
  @ApiProperty({ nullable: true, type: String }) instagramUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) facebookUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) tiktokUrl!: string | null;
  @ApiProperty() nationalFreeShipping!: boolean;
  @ApiProperty({ nullable: true, type: Number }) freeShippingThreshold!: number | null;
  @ApiProperty({ nullable: true, type: Number }) defaultLowStockThreshold!: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxPercentageDiscount!: number | null;
}

/** Datos públicos de la tienda (sin cifras internas). */
export class ShippingRateDto {
  @ApiProperty() id!: string;
  @ApiProperty() municipalityCode!: string;
  @ApiProperty() municipalityName!: string;
  @ApiProperty() departmentName!: string;
  @ApiProperty({ type: Number }) amount!: number;
}

export class UpsertShippingRateDto {
  @ApiProperty({ example: '44001' })
  @Matches(/^\d{5}$/, { message: 'Código de municipio inválido.' })
  municipalityCode!: string;

  @ApiProperty({ example: 5000 })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Ingresa un valor en pesos.' })
  @Min(0)
  @Max(MAX_MONEY)
  amount!: number;
}

export class PublicStoreInfoDto {
  @ApiProperty() storeName!: string;
  @ApiProperty({ nullable: true, type: String }) whatsappNumber!: string | null;
  @ApiProperty({ nullable: true, type: String }) contactEmail!: string | null;
  @ApiProperty({ nullable: true, type: String }) contactPhone!: string | null;
  @ApiProperty({ nullable: true, type: String }) addressText!: string | null;
  @ApiProperty({ nullable: true, type: String }) businessHours!: string | null;
  @ApiProperty({ nullable: true, type: String }) instagramUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) facebookUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) tiktokUrl!: string | null;
  @ApiProperty({ nullable: true, type: String }) heroTitle!: string | null;
  @ApiProperty({ nullable: true, type: String }) heroSubtitle!: string | null;
  @ApiProperty({ nullable: true, type: String }) tagline!: string | null;
  @ApiProperty({ nullable: true, type: String }) announcementText!: string | null;
  @ApiProperty({
    description: 'Páginas de texto publicadas (con texto cargado), para enlazarlas en la tienda.',
    type: [String],
  })
  publishedPages!: string[];
}
