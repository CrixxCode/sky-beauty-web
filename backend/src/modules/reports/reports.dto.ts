import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Rango de fechas (días completos en hora de Colombia, ambos incluidos). */
export class ReportRangeQueryDto {
  @ApiProperty({ example: '2026-10-01', description: 'Desde (AAAA-MM-DD).' })
  @Matches(DATE_PATTERN, { message: 'La fecha inicial debe tener el formato AAAA-MM-DD.' })
  from!: string;

  @ApiProperty({ example: '2026-10-31', description: 'Hasta (AAAA-MM-DD), incluido.' })
  @Matches(DATE_PATTERN, { message: 'La fecha final debe tener el formato AAAA-MM-DD.' })
  to!: string;
}

export const REPORT_GROUPINGS = ['day', 'week', 'month'] as const;
export type ReportGrouping = (typeof REPORT_GROUPINGS)[number];

export class SalesReportQueryDto extends ReportRangeQueryDto {
  @ApiPropertyOptional({ enum: REPORT_GROUPINGS, default: 'day' })
  @IsOptional()
  @IsIn(REPORT_GROUPINGS)
  groupBy?: ReportGrouping;
}

export class TopProductsQueryDto extends ReportRangeQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SalesSummaryDto {
  @ApiProperty() orders!: number;
  @ApiProperty({ description: 'Productos con descuentos aplicados.' }) productsRevenue!: number;
  @ApiProperty() discounts!: number;
  @ApiProperty({ description: 'Envío cobrado al cliente.' }) shippingCharged!: number;
  @ApiProperty({ description: 'Total cobrado (productos + envío).' }) total!: number;
  @ApiProperty() averageTicket!: number;
}

export class SalesPeriodDto {
  @ApiProperty({ description: 'Inicio del período (AAAA-MM-DD).' }) period!: string;
  @ApiProperty() orders!: number;
  @ApiProperty() productsRevenue!: number;
  @ApiProperty() total!: number;
}

export class SalesReportDto {
  @ApiProperty({ type: () => SalesSummaryDto }) summary!: SalesSummaryDto;
  @ApiProperty({ type: () => SalesPeriodDto, isArray: true }) series!: SalesPeriodDto[];
}

export class TopProductDto {
  @ApiProperty() productName!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() units!: number;
  @ApiProperty() revenue!: number;
}

export class ProductMarginDto {
  @ApiProperty() productName!: string;
  @ApiProperty() variantName!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() units!: number;
  @ApiProperty() revenue!: number;
  @ApiProperty() cost!: number;
  @ApiProperty() profit!: number;
  @ApiProperty({ description: 'Ganancia / ventas, en %.' }) marginPct!: number;
}

export class MarginsReportDto {
  @ApiProperty({ description: 'Ventas de productos con costo registrado.' }) revenue!: number;
  @ApiProperty() cost!: number;
  @ApiProperty() profit!: number;
  @ApiProperty() marginPct!: number;
  @ApiProperty({ description: 'Unidades vendidas sin costo registrado (fuera del cálculo).' })
  unitsWithoutCost!: number;
  @ApiProperty() revenueWithoutCost!: number;
  @ApiProperty({ description: 'Envío cobrado al cliente.' }) shippingCharged!: number;
  @ApiProperty({ description: 'Costo real registrado de las transportadoras.' })
  shippingCarrierCost!: number;
  @ApiProperty({ type: () => ProductMarginDto, isArray: true }) byProduct!: ProductMarginDto[];
}
