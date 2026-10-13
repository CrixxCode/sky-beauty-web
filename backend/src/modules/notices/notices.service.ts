import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../../config/env';
import {
  CancellationNoticeCase,
  CancellationNoticeStage,
  CancellationNoticeStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { closePendingBeforeNotices, createNotice, NOTICE_CASE_NAMES } from './notice-records';
import type {
  AdminNotificationDto,
  CancellationNoticeDto,
  ListNoticesQueryDto,
  NotificationsDto,
} from './notices.dto';

const HOUR = 60 * 60 * 1000;
/** Clave del bloqueo de PostgreSQL que evita que dos instancias procesen los plazos a la vez. */
const CYCLE_LOCK_KEY = 2026_10_13;

export interface CycleResult {
  beforeCreated: number;
  cancelled: number;
  closed: number;
}

/**
 * Cancelaciones automáticas y avisos (módulo 11). Cada minuto revisa los plazos:
 * - 1 hora antes de vencer, crea el aviso "se cancelará en 1 hora" de cada caso;
 * - al vencer, cancela los pedidos sin confirmar (48 h) y sin comprobante (24 h);
 * - el pago no demostrado (8 h) no se cancela solo: lo cancela una persona.
 */
@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    // En las pruebas automáticas el ciclo se ejecuta a mano con una fecha controlada.
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    try {
      const result = await this.runLocked(new Date());
      if (result && (result.beforeCreated || result.cancelled || result.closed)) {
        this.logger.log(result, 'Ciclo de plazos de pedidos');
      }
    } catch (err: unknown) {
      this.logger.error(err, 'Falló el ciclo de plazos de pedidos');
    }
  }

  /**
   * Ejecuta el ciclo solo si ninguna otra instancia lo está ejecutando. El bloqueo es de
   * transacción: se libera solo al terminar, aunque el pool de conexiones cambie de conexión.
   */
  async runLocked(now: Date): Promise<CycleResult | null> {
    return this.prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw<[{ locked: boolean }]>`
          SELECT pg_try_advisory_xact_lock(${CYCLE_LOCK_KEY}) AS locked`;
        if (!locked) return null;
        return this.runCycle(now);
      },
      { timeout: 5 * 60 * 1000, maxWait: 10_000 },
    );
  }

  async runCycle(now = new Date()): Promise<CycleResult> {
    const result: CycleResult = { beforeCreated: 0, cancelled: 0, closed: 0 };
    const pendingHours = this.config.get('ORDER_PENDING_TTL_HOURS', { infer: true });
    const unpaidHours = this.config.get('ORDER_UNPAID_TTL_HOURS', { infer: true });
    const clarificationHours = this.config.get('ORDER_PAYMENT_CLARIFICATION_HOURS', {
      infer: true,
    });

    // 1. Sin confirmar: 48 horas desde que se creó.
    if (pendingHours > 0) {
      const orders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING_CONFIRMATION,
          createdAt: { lte: new Date(now.getTime() - (pendingHours - 1) * HOUR) },
        },
        select: { id: true, code: true, customerName: true, createdAt: true },
      });
      for (const order of orders) {
        const deadline = new Date(order.createdAt.getTime() + pendingHours * HOUR);
        await this.handleDeadline(order, CancellationNoticeCase.UNCONFIRMED, deadline, now, result);
      }
    }

    // 2. Confirmado sin comprobante: 24 horas desde la confirmación (no aplica a contra entrega).
    if (unpaidHours > 0) {
      const orders = await this.prisma.order.findMany({
        where: {
          status: { in: [OrderStatus.CONFIRMED, OrderStatus.PREPARING] },
          paymentStatus: PaymentStatus.PENDING,
          paymentMethodCode: { not: 'CASH_ON_DELIVERY' },
          confirmedAt: { lte: new Date(now.getTime() - (unpaidHours - 1) * HOUR) },
        },
        select: { id: true, code: true, customerName: true, confirmedAt: true },
      });
      for (const order of orders) {
        if (!order.confirmedAt) continue;
        const deadline = new Date(order.confirmedAt.getTime() + unpaidHours * HOUR);
        await this.handleDeadline(
          order,
          CancellationNoticeCase.NO_PAYMENT_PROOF,
          deadline,
          now,
          result,
        );
      }
    }

    // 3. Pago no demostrado: aviso 1 hora antes de que venza el plazo de aclaración.
    if (clarificationHours > 0) {
      const orders = await this.prisma.order.findMany({
        where: {
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.SHIPPED, OrderStatus.DELIVERED] },
          paymentStatus: PaymentStatus.REJECTED,
          paymentRejectedAt: {
            lte: new Date(now.getTime() - (clarificationHours - 1) * HOUR),
            gt: new Date(now.getTime() - clarificationHours * HOUR),
          },
        },
        select: { id: true, code: true, customerName: true, paymentRejectedAt: true },
      });
      for (const order of orders) {
        if (!order.paymentRejectedAt) continue;
        const deadline = new Date(order.paymentRejectedAt.getTime() + clarificationHours * HOUR);
        const created = await this.createNoticeOnce((tx) =>
          createNotice(tx, {
            order,
            noticeCase: CancellationNoticeCase.PAYMENT_NOT_PROVEN,
            stage: CancellationNoticeStage.BEFORE,
            deadlineAt: deadline,
          }),
        );
        if (created) result.beforeCreated += 1;
      }
    }

    result.closed += await this.closeObsoleteNotices(now);
    return result;
  }

  /** Antes del plazo crea el aviso; vencido, cancela el pedido (casos 1 y 2). */
  private async handleDeadline(
    order: { id: string; code: string; customerName: string },
    noticeCase: CancellationNoticeCase,
    deadline: Date,
    now: Date,
    result: CycleResult,
  ): Promise<void> {
    if (now >= deadline) {
      if (await this.orders.autoCancel(order.id, noticeCase, deadline, now)) result.cancelled += 1;
      return;
    }
    const created = await this.createNoticeOnce((tx) =>
      createNotice(tx, {
        order,
        noticeCase,
        stage: CancellationNoticeStage.BEFORE,
        deadlineAt: deadline,
      }),
    );
    if (created) result.beforeCreated += 1;
  }

  /**
   * Crea un aviso en su propia transacción. Si otro ciclo lo creó al mismo tiempo, la restricción
   * única lo impide y se cuenta como ya existente.
   */
  private async createNoticeOnce(
    create: (tx: Prisma.TransactionClient) => Promise<boolean>,
  ): Promise<boolean> {
    try {
      return await this.prisma.$transaction(create);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
        return false;
      }
      throw err;
    }
  }

  /**
   * Cierra los avisos "antes" pendientes que ya no aplican (el cliente resolvió a tiempo o el
   * pedido cambió) y vence los de pago no demostrado cuyo plazo pasó sin enviarse.
   */
  private async closeObsoleteNotices(now: Date): Promise<number> {
    const pending = await this.prisma.cancellationNotice.findMany({
      where: { stage: CancellationNoticeStage.BEFORE, status: CancellationNoticeStatus.PENDING },
      include: { order: { select: { status: true, paymentStatus: true } } },
    });
    let closed = 0;
    for (const notice of pending) {
      const { status, paymentStatus } = notice.order;
      const stillApplies =
        notice.case === CancellationNoticeCase.UNCONFIRMED
          ? status === OrderStatus.PENDING_CONFIRMATION
          : notice.case === CancellationNoticeCase.NO_PAYMENT_PROOF
            ? (status === OrderStatus.CONFIRMED || status === OrderStatus.PREPARING) &&
              paymentStatus === PaymentStatus.PENDING
            : paymentStatus === PaymentStatus.REJECTED &&
              status !== OrderStatus.CANCELLED &&
              notice.deadlineAt > now;
      if (stillApplies) continue;
      await this.prisma.$transaction((tx) =>
        closePendingBeforeNotices(tx, notice.orderId, [notice.case], now),
      );
      closed += 1;
    }
    return closed;
  }

  // ── Bandeja de avisos ──────────────────────────────────────────────────────

  async listNotices(query: ListNoticesQueryDto): Promise<CancellationNoticeDto[]> {
    const notices = await this.prisma.cancellationNotice.findMany({
      where: { status: query.status ?? CancellationNoticeStatus.PENDING },
      include: {
        order: { select: { code: true, customerName: true, customerPhone: true } },
        sentBy: { select: { name: true } },
      },
      orderBy: [{ createdAt: query.status === 'PENDING' || !query.status ? 'asc' : 'desc' }],
      take: 100,
    });
    return notices.map((notice) => ({
      id: notice.id,
      orderId: notice.orderId,
      orderCode: notice.order.code,
      customerName: notice.order.customerName,
      customerPhone: notice.order.customerPhone,
      case: notice.case,
      caseName: NOTICE_CASE_NAMES[notice.case],
      stage: notice.stage,
      status: notice.status,
      deadlineAt: notice.deadlineAt,
      message: notice.message,
      whatsappUrl: `https://wa.me/${notice.order.customerPhone}?text=${encodeURIComponent(notice.message)}`,
      createdAt: notice.createdAt,
      sentAt: notice.sentAt,
      sentByName: notice.sentBy?.name ?? null,
    }));
  }

  async pendingCount(): Promise<number> {
    return this.prisma.cancellationNotice.count({
      where: { status: CancellationNoticeStatus.PENDING },
    });
  }

  /** Marca un aviso como enviado por WhatsApp (solo si sigue pendiente). */
  async markSent(id: string, adminId: string): Promise<void> {
    const { count } = await this.prisma.cancellationNotice.updateMany({
      where: { id, status: CancellationNoticeStatus.PENDING },
      data: { status: CancellationNoticeStatus.SENT, sentAt: new Date(), sentById: adminId },
    });
    if (count === 1) return;
    const exists = await this.prisma.cancellationNotice.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('No existe ese aviso.');
    throw new ConflictException('Este aviso ya no está pendiente.');
  }

  // ── Notificaciones del panel ───────────────────────────────────────────────

  async notifications(adminId: string, limit = 20): Promise<NotificationsDto> {
    const [items, unread] = await Promise.all([
      this.prisma.adminNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { reads: { where: { adminId }, select: { readAt: true } } },
      }),
      this.prisma.adminNotification.count({ where: { reads: { none: { adminId } } } }),
    ]);
    return {
      unread,
      items: items.map(
        (item): AdminNotificationDto => ({
          id: item.id,
          type: item.type,
          title: item.title,
          body: item.body,
          orderId: item.orderId,
          noticeId: item.noticeId,
          createdAt: item.createdAt,
          read: item.reads.length > 0,
        }),
      ),
    };
  }

  async markRead(id: string, adminId: string): Promise<void> {
    const exists = await this.prisma.adminNotification.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('No existe esa notificación.');
    await this.prisma.adminNotificationRead.upsert({
      where: { notificationId_adminId: { notificationId: id, adminId } },
      create: { notificationId: id, adminId },
      update: {},
    });
  }

  async markAllRead(adminId: string): Promise<void> {
    const unread = await this.prisma.adminNotification.findMany({
      where: { reads: { none: { adminId } } },
      select: { id: true },
    });
    if (unread.length === 0) return;
    await this.prisma.adminNotificationRead.createMany({
      data: unread.map((n) => ({ notificationId: n.id, adminId })),
      skipDuplicates: true,
    });
  }
}
