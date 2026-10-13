import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Recorta textos y convierte cadenas vacías en null (null borra el texto). */
const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const LEGAL_MAX = 50_000;

/**
 * Contenido de la tienda (módulo 12). Solo la propietaria lo edita. Los textos legales se publican
 * solo cuando estén aprobados (decisión "Políticas y términos para clientes").
 */
export class UpdateStoreContentDto {
  @ApiPropertyOptional({
    nullable: true,
    maxLength: 160,
    description: 'Descripción para buscadores.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(160)
  tagline?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 120 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(120)
  heroTitle?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 300 })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(300)
  heroSubtitle?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 160, description: 'Barra de anuncio.' })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(160)
  announcementText?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: LEGAL_MAX })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(LEGAL_MAX)
  termsText?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: LEGAL_MAX })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(LEGAL_MAX)
  privacyText?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: LEGAL_MAX })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(LEGAL_MAX)
  returnsPolicyText?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: LEGAL_MAX })
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(LEGAL_MAX)
  shippingPolicyText?: string | null;
}

export class StoreContentDto {
  @ApiProperty({ nullable: true, type: String }) tagline!: string | null;
  @ApiProperty({ nullable: true, type: String }) heroTitle!: string | null;
  @ApiProperty({ nullable: true, type: String }) heroSubtitle!: string | null;
  @ApiProperty({ nullable: true, type: String }) announcementText!: string | null;
  @ApiProperty({ nullable: true, type: String }) termsText!: string | null;
  @ApiProperty({ nullable: true, type: String }) privacyText!: string | null;
  @ApiProperty({ nullable: true, type: String }) returnsPolicyText!: string | null;
  @ApiProperty({ nullable: true, type: String }) shippingPolicyText!: string | null;
}

/** Páginas de texto de la tienda y el campo de la configuración que las alimenta. */
export const STORE_PAGES = {
  terminos: { field: 'termsText', title: 'Términos y condiciones' },
  'datos-personales': { field: 'privacyText', title: 'Tratamiento de datos personales' },
  'cambios-y-garantias': { field: 'returnsPolicyText', title: 'Cambios, devoluciones y garantías' },
  envios: { field: 'shippingPolicyText', title: 'Política de envíos' },
} as const;

export type StorePageSlug = keyof typeof STORE_PAGES;

export class PublicStorePageDto {
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty() text!: string;
}
