import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type {
  MarginsReportDto,
  ReportGrouping,
  ReportRangeQueryDto,
  SalesReportDto,
  TopProductDto,
} from './reports.dto';

const TIME_ZONE = 'America/Bogota';
const MAX_RANGE_DAYS = 366 * 3;

const round = (value: number) => Math.round(value * 100) / 100;
const pct = (part: number, whole: number) => (whole > 0 ? round((part / whole) * 100) : 0);

/**
 * Reportes para la propietaria (módulo 13; decisión del 2026-10-13). Una venta es un pedido con el
 * pago verificado (incluye contra entrega pagado al entregarse); no cuentan los cancelados ni los
 * devueltos. Las ventas se ubican por la fecha del pedido, en hora de Colombia.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Filtro común: pedidos vendidos dentro del rango (días completos en hora de Colombia). */
  private salesFilter(range: ReportRangeQueryDto, alias = 'o'): Prisma.Sql {
    const from = new Date(`${range.from}T00:00:00Z`);
    const to = new Date(`${range.to}T00:00:00Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Las fechas no son válidas.');
    }
    if (to < from) {
      throw new BadRequestException('La fecha final no puede ser anterior a la inicial.');
    }
    if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_RANGE_DAYS) {
      throw new BadRequestException('El rango no puede superar 3 años.');
    }
    const o = Prisma.raw(`"${alias}"`);
    return Prisma.sql`${o}."paymentStatus" = 'PAID'
      AND ${o}."status" <> 'CANCELLED'
      AND ${o}."createdAt" >= (${range.from}::date::timestamp AT TIME ZONE ${TIME_ZONE})
      AND ${o}."createdAt" < ((${range.to}::date + 1)::timestamp AT TIME ZONE ${TIME_ZONE})`;
  }

  async sales(
    range: ReportRangeQueryDto,
    groupBy: ReportGrouping = 'day',
  ): Promise<SalesReportDto> {
    const filter = this.salesFilter(range);

    const [summary] = await this.prisma.$queryRaw<
      Array<{
        orders: number;
        products: number;
        discounts: number;
        shipping: number;
        total: number;
      }>
    >`
      SELECT count(*)::int AS orders,
             coalesce(sum(o."subtotal" - o."discountTotal"), 0)::float8 AS products,
             coalesce(sum(o."discountTotal"), 0)::float8 AS discounts,
             coalesce(sum(o."shippingCost"), 0)::float8 AS shipping,
             coalesce(sum(o."total"), 0)::float8 AS total
      FROM "Order" o
      WHERE ${filter}`;

    // Todos los períodos del rango, también los que no tuvieron ventas.
    const series = await this.prisma.$queryRaw<
      Array<{ period: string; orders: number; products: number; total: number }>
    >`
      WITH sales AS (
        SELECT date_trunc(${groupBy}, o."createdAt" AT TIME ZONE ${TIME_ZONE}) AS period,
               count(*)::int AS orders,
               sum(o."subtotal" - o."discountTotal") AS products,
               sum(o."total") AS total
        FROM "Order" o
        WHERE ${filter}
        GROUP BY 1
      )
      SELECT to_char(p, 'YYYY-MM-DD') AS period,
             coalesce(s.orders, 0)::int AS orders,
             coalesce(s.products, 0)::float8 AS products,
             coalesce(s.total, 0)::float8 AS total
      FROM generate_series(
             date_trunc(${groupBy}, ${range.from}::date::timestamp),
             date_trunc(${groupBy}, ${range.to}::date::timestamp),
             ('1 ' || ${groupBy})::interval
           ) AS p
      LEFT JOIN sales s ON s.period = p
      ORDER BY p`;

    return {
      summary: {
        orders: summary.orders,
        productsRevenue: round(summary.products),
        discounts: round(summary.discounts),
        shippingCharged: round(summary.shipping),
        total: round(summary.total),
        averageTicket: summary.orders > 0 ? round(summary.total / summary.orders) : 0,
      },
      series: series.map((row) => ({
        period: row.period,
        orders: row.orders,
        productsRevenue: round(row.products),
        total: round(row.total),
      })),
    };
  }

  /** Variantes más vendidas por unidades (con el nombre y SKU guardados en el pedido). */
  async topProducts(range: ReportRangeQueryDto, limit = 20): Promise<TopProductDto[]> {
    const filter = this.salesFilter(range);
    const rows = await this.prisma.$queryRaw<
      Array<{
        productName: string;
        variantName: string;
        sku: string;
        units: number;
        revenue: number;
      }>
    >`
      SELECT max(i."productName") AS "productName",
             max(i."variantName") AS "variantName",
             i."sku" AS sku,
             sum(i."quantity")::int AS units,
             sum(i."lineTotal")::float8 AS revenue
      FROM "OrderItem" i
      JOIN "Order" o ON o."id" = i."orderId"
      WHERE ${filter}
      GROUP BY i."sku"
      ORDER BY units DESC, revenue DESC, sku
      LIMIT ${limit}`;
    return rows.map((row) => ({ ...row, revenue: round(row.revenue) }));
  }

  /**
   * Ganancia de productos = ventas de productos (con descuentos) − costo de compra guardado en el
   * pedido. Las unidades sin costo registrado quedan fuera del cálculo y se informan aparte. El
   * envío se muestra aparte: lo cobrado al cliente y el costo real de las transportadoras.
   */
  async margins(range: ReportRangeQueryDto): Promise<MarginsReportDto> {
    const filter = this.salesFilter(range);

    const byProduct = await this.prisma.$queryRaw<
      Array<{
        productName: string;
        variantName: string;
        sku: string;
        units: number;
        revenue: number;
        cost: number;
      }>
    >`
      SELECT max(i."productName") AS "productName",
             max(i."variantName") AS "variantName",
             i."sku" AS sku,
             sum(i."quantity")::int AS units,
             sum(i."lineTotal")::float8 AS revenue,
             sum(i."unitCost" * i."quantity")::float8 AS cost
      FROM "OrderItem" i
      JOIN "Order" o ON o."id" = i."orderId"
      WHERE ${filter} AND i."unitCost" IS NOT NULL
      GROUP BY i."sku"
      ORDER BY (sum(i."lineTotal") - sum(i."unitCost" * i."quantity")) DESC, sku`;

    const [withoutCost] = await this.prisma.$queryRaw<Array<{ units: number; revenue: number }>>`
      SELECT coalesce(sum(i."quantity"), 0)::int AS units,
             coalesce(sum(i."lineTotal"), 0)::float8 AS revenue
      FROM "OrderItem" i
      JOIN "Order" o ON o."id" = i."orderId"
      WHERE ${filter} AND i."unitCost" IS NULL`;

    const [shipping] = await this.prisma.$queryRaw<Array<{ charged: number; carrier: number }>>`
      SELECT coalesce(sum(o."shippingCost"), 0)::float8 AS charged,
             coalesce(sum(s."carrierCost"), 0)::float8 AS carrier
      FROM "Order" o
      LEFT JOIN "Shipping" s ON s."orderId" = o."id"
      WHERE ${filter}`;

    const revenue = byProduct.reduce((sum, row) => sum + row.revenue, 0);
    const cost = byProduct.reduce((sum, row) => sum + row.cost, 0);
    return {
      revenue: round(revenue),
      cost: round(cost),
      profit: round(revenue - cost),
      marginPct: pct(revenue - cost, revenue),
      unitsWithoutCost: withoutCost.units,
      revenueWithoutCost: round(withoutCost.revenue),
      shippingCharged: round(shipping.charged),
      shippingCarrierCost: round(shipping.carrier),
      byProduct: byProduct.map((row) => ({
        ...row,
        revenue: round(row.revenue),
        cost: round(row.cost),
        profit: round(row.revenue - row.cost),
        marginPct: pct(row.revenue - row.cost, row.revenue),
      })),
    };
  }
}
