import { Injectable } from '@nestjs/common';
import {
  CancellationNoticeStatus,
  OrderStatus,
  PaymentStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { DashboardPendingDto } from './dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Contadores del Resumen. Cada uno usa el mismo criterio que la sección a la que enlaza, para
   * que la cifra coincida con lo que se ve al entrar.
   */
  async pending(): Promise<DashboardPendingDto> {
    const [ordersToConfirm, paymentsToVerify, noticesToSend, [{ lowStock }]] = await Promise.all([
      this.prisma.order.count({ where: { status: OrderStatus.PENDING_CONFIRMATION } }),
      this.prisma.order.count({
        where: {
          paymentStatus: PaymentStatus.AWAITING_VERIFICATION,
          status: { not: OrderStatus.CANCELLED },
        },
      }),
      this.prisma.cancellationNotice.count({ where: { status: CancellationNoticeStatus.PENDING } }),
      // Igual que el filtro "Stock bajo" de Inventario.
      this.prisma.$queryRaw<[{ lowStock: number }]>`
        SELECT count(*)::int AS "lowStock"
        FROM "ProductVariant"
        WHERE "lowStockThreshold" IS NOT NULL AND "stock" <= "lowStockThreshold"`,
    ]);
    return { ordersToConfirm, paymentsToVerify, noticesToSend, lowStockVariants: lowStock };
  }
}
