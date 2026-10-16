import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { Env } from '../../config/env';
import {
  AdminNotificationType,
  AdminRole,
  CancellationNoticeCase,
  CancellationNoticeStage,
  CancellationNoticeStatus,
  InventoryMovementType,
  OrderEventType,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ShippingMethod,
  ShippingStatus,
} from '../../generated/prisma/client';
import { normalizeWhatsappNumber, WHATSAPP_NUMBER_PATTERN } from '../../shared/phone';
import { effectiveMaxPerOrder } from '../../shared/max-per-order';
import { uploadUrl } from '../../shared/uploads';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  ALL_NOTICE_CASES,
  autoCancelReason,
  closePendingBeforeNotices,
  createNotice,
  publicNoticeText,
} from '../notices/notice-records';
import { PricingService } from '../promotions/pricing.service';
import { StoreSettingsService } from '../store-settings/store-settings.service';
import type {
  AvailablePaymentMethodDto,
  CartQuoteDto,
  CartQuoteItemDto,
  CancelOrderDto,
  ChangeOrderStatusDto,
  ConfirmOrderDto,
  CreateOrderDto,
  CreatedOrderDto,
  ListOrdersQueryDto,
  LookupOrderDto,
  LookupOrderResultDto,
  PaginatedAdminOrdersDto,
  PublicOrderTrackingDto,
  QuoteCartDto,
  QuoteShippingDto,
  RefundPaymentDto,
  RegisterPaymentReceivedDto,
  RejectPaymentDto,
  UpsertOrderShippingDto,
  UpdateOrderItemsDto,
  AdminOrderDto,
  AdminOrderListItemDto,
  VerifyPaymentDto,
} from './orders.dto';
import { escapeLike } from '../../shared/text';

type MethodForCheckout = Prisma.PaymentMethodGetPayload<{
  include: { cities: true };
}>;

const ORDER_DETAIL_INCLUDE = {
  items: { orderBy: { createdAt: 'asc' } },
  statusHistory: { orderBy: { createdAt: 'desc' } },
  paymentRecords: { orderBy: { createdAt: 'desc' } },
  shipping: { include: { carrier: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderInclude;

type OrderDetail = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

/**
 * Cambios de estado permitidos desde "cambiar estado": solo marcar en preparación (opcional).
 * Confirmar y cancelar tienen sus propias acciones, y despachar y entregar se registran en el
 * envío (por transportadora o entrega local; decisión del 2026-10-13).
 */
const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING_CONFIRMATION: [],
  CONFIRMED: [OrderStatus.PREPARING],
  PREPARING: [],
  SHIPPED: [],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * Avance del envío. Una novedad (por ejemplo, una dirección errada) puede volver a tránsito o
 * terminar en entrega; un envío entregado ya no cambia de estado (sí se pueden corregir sus datos).
 */
const NEXT_SHIPPING_STATUSES: Record<ShippingStatus, ShippingStatus[]> = {
  NOT_SHIPPED: [ShippingStatus.NOT_SHIPPED, ShippingStatus.IN_TRANSIT, ShippingStatus.DELIVERED],
  IN_TRANSIT: [ShippingStatus.IN_TRANSIT, ShippingStatus.INCIDENT, ShippingStatus.DELIVERED],
  INCIDENT: [ShippingStatus.INCIDENT, ShippingStatus.IN_TRANSIT, ShippingStatus.DELIVERED],
  DELIVERED: [ShippingStatus.DELIVERED],
};

const SHIPPING_STATUS_NAMES: Record<ShippingStatus, string> = {
  NOT_SHIPPED: 'Sin despachar',
  IN_TRANSIT: 'En tránsito',
  DELIVERED: 'Entregado',
  INCIDENT: 'Con novedad',
};

const ORDER_STATUS_NAMES: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: 'Sin confirmar',
  CONFIRMED: 'Confirmado',
  PREPARING: 'Preparando',
  SHIPPED: 'Despachado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

function money(value: number): number {
  return Math.round(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableHash(input: unknown): string {
  return sha256(JSON.stringify(input));
}

function uniqueCartItems(items: QuoteCartDto['items']): QuoteCartDto['items'] {
  const grouped = new Map<string, number>();
  for (const item of items) {
    grouped.set(item.variantId, (grouped.get(item.variantId) ?? 0) + item.quantity);
  }
  return [...grouped.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}

function toPaymentMethodDto(method: MethodForCheckout): AvailablePaymentMethodDto {
  return {
    id: method.id,
    code: method.code,
    name: method.name,
    instructions: method.instructions,
    requiresVerification: method.requiresVerification,
  };
}

const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Importe en pesos colombianos, p. ej. "$ 15.000". */
function cop(value: number): string {
  return copFormatter.format(value);
}

/** Envío por confirmar (null), gratis (0) o con tarifa calculada. */
function shippingLabel(shippingCost: number | null): string {
  if (shippingCost === null) return 'Envío por confirmar';
  if (shippingCost === 0) return 'Envío gratis';
  return `Envío: ${cop(shippingCost)}`;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  );
}

/**
 * Mensaje que el cliente envía por WhatsApp al terminar el checkout: identifica el pedido e
 * incluye productos, variantes, cantidades, importes y datos de entrega (negocio.md, sección 6).
 */
function buildWhatsappMessage(
  order: {
    code: string;
    customerName: string;
    customerPhone: string;
    city: string;
    department: string;
    addressLine: string;
    deliveryNotes: string | null;
  },
  summary: CreatedOrderDto['summary'],
  trackingUrl: string,
): string {
  const lines: Array<string | null> = [
    `Hola, quiero continuar con mi pedido ${order.code}.`,
    '',
    'Productos:',
    ...summary.items.map(
      (item) =>
        `- ${item.productName} (${item.variantName}) x${item.quantity}: ${cop(item.lineTotal)}`,
    ),
    '',
    `Subtotal: ${cop(summary.subtotal)}`,
    summary.discountTotal > 0 ? `Descuento: -${cop(summary.discountTotal)}` : null,
    `${summary.shippingLabel}`,
    summary.shippingCost === null
      ? `Total sin envío: ${cop(summary.total)}`
      : `Total: ${cop(summary.total)}`,
    '',
    'Datos de entrega:',
    `Nombre: ${order.customerName}`,
    `Teléfono: ${order.customerPhone}`,
    `Municipio: ${order.city}, ${order.department}`,
    `Dirección: ${order.addressLine}`,
    order.deliveryNotes ? `Indicaciones: ${order.deliveryNotes}` : null,
    `Método de pago: ${summary.paymentMethodName}`,
    '',
    `Seguimiento del pedido: ${trackingUrl}`,
  ];
  return lines.filter((line): line is string => line !== null).join('\n');
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly settings: StoreSettingsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Valida y cotiza el carrito con precios, promociones y envío calculados en el servidor.
   * No falla por un artículo con problemas: lo marca para que el cliente lo corrija, y
   * `canCheckout` indica si se puede crear el pedido.
   */
  async quoteCart(dto: QuoteCartDto): Promise<CartQuoteDto> {
    const items = uniqueCartItems(dto.items);
    const variants = await this.prisma.productVariant.findMany({
      where: {
        id: { in: items.map((item) => item.variantId) },
        isActive: true,
        product: { status: 'ACTIVE' },
      },
      include: {
        images: { orderBy: { position: 'asc' } },
        product: {
          include: {
            images: { where: { variantId: null }, orderBy: { position: 'asc' } },
          },
        },
      },
    });

    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const unavailableVariantIds = items
      .filter((item) => !variantById.has(item.variantId))
      .map((item) => item.variantId);
    const available = items.filter((item) => variantById.has(item.variantId));
    const priceMap = await this.pricing.priceVariantsAt(available.map((item) => item.variantId));
    const quoteItems: CartQuoteItemDto[] = [];
    const settings = await this.settings.get();

    for (const item of available) {
      const variant = variantById.get(item.variantId);
      const price = priceMap.get(item.variantId);
      if (!variant || !price) {
        throw new BadRequestException('No se pudo calcular el precio de un producto.');
      }
      const image = variant.images[0] ?? variant.product.images[0] ?? null;
      const maxPerOrder = effectiveMaxPerOrder(variant.maxPerOrder, settings.maxUnitsPerProduct);
      quoteItems.push({
        variantId: variant.id,
        productId: variant.productId,
        productName: variant.product.name,
        productSlug: variant.product.slug,
        variantName: variant.name,
        sku: variant.sku,
        imageUrl: image ? uploadUrl(image.thumbnailKey) : null,
        quantity: item.quantity,
        maxQuantity: Math.min(variant.stock, maxPerOrder ?? variant.stock),
        maxPerOrder,
        issue: this.itemIssue(item.quantity, { stock: variant.stock, maxPerOrder }),
        unitListPrice: money(price.regularPrice),
        unitDiscount: money(price.discountAmount),
        unitFinalPrice: money(price.finalPrice),
        lineSubtotal: money(price.regularPrice * item.quantity),
        lineDiscount: money(price.discountAmount * item.quantity),
        lineTotal: money(price.finalPrice * item.quantity),
        promotionId: price.appliedPromotion?.promotionId ?? null,
        promotionName: price.appliedPromotion?.promotionName ?? null,
      });
    }

    const subtotal = quoteItems.reduce((sum, item) => sum + item.lineSubtotal, 0);
    const discountTotal = quoteItems.reduce((sum, item) => sum + item.lineDiscount, 0);
    const productsTotal = quoteItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const configuredRate = dto.municipalityCode
      ? await this.prisma.municipalShippingRate.findUnique({
          where: { municipalityCode: dto.municipalityCode },
        })
      : null;
    const shippingCost = this.checkoutShippingCost(
      productsTotal,
      settings.nationalFreeShipping,
      settings.freeShippingThreshold,
      configuredRate?.amount.toNumber() ?? null,
    );
    const total = productsTotal + (shippingCost ?? 0);

    return {
      items: quoteItems,
      subtotal,
      discountTotal,
      shippingCost,
      total,
      freeShippingThreshold: settings.freeShippingThreshold,
      shippingLabel: shippingLabel(shippingCost),
      availablePaymentMethods: await this.availablePaymentMethods(dto.municipalityCode, total),
      unavailableVariantIds,
      canCheckout:
        quoteItems.length > 0 &&
        unavailableVariantIds.length === 0 &&
        quoteItems.every((item) => item.issue === null),
    };
  }

  async createOrder(dto: CreateOrderDto): Promise<CreatedOrderDto> {
    if (!dto.termsAccepted || !dto.dataProcessingAccepted) {
      throw new BadRequestException('Debes aceptar las dos casillas obligatorias del checkout.');
    }

    const customerPhone = normalizeWhatsappNumber(dto.customerPhone);
    if (!WHATSAPP_NUMBER_PATTERN.test(customerPhone)) {
      throw new BadRequestException('El teléfono no tiene un formato válido.');
    }

    const normalized = {
      ...dto,
      customerName: dto.customerName.trim(),
      customerPhone,
      addressLine: dto.addressLine.trim(),
      deliveryNotes: dto.deliveryNotes?.trim() || null,
      items: uniqueCartItems(dto.items),
    };
    const requestHash = stableHash(normalized);
    // Reintento del mismo checkout (por ejemplo, tras un corte de red): se devuelve el pedido ya
    // creado, sin volver a cotizar ni reservar.
    const replay = await this.replayIdempotent(dto.idempotencyKey, requestHash);
    if (replay) return replay;

    const quote = await this.quoteCart({
      items: normalized.items,
      municipalityCode: dto.municipalityCode,
    });
    if (quote.unavailableVariantIds.length > 0) {
      throw new BadRequestException('Uno o más productos del carrito ya no están disponibles.');
    }
    const blocked = quote.items.find((item) => item.issue !== null);
    if (blocked) {
      throw new BadRequestException(
        blocked.issue === 'OVER_MAX_PER_ORDER'
          ? `${blocked.productName} permite máximo ${blocked.maxPerOrder} unidades por pedido.`
          : `No hay existencias suficientes para ${blocked.productName}.`,
      );
    }
    const paymentMethod = await this.ensurePaymentMethod(
      dto.paymentMethodId,
      dto.municipalityCode,
      quote.total,
    );
    const municipality = await this.prisma.municipality.findUnique({
      where: { code: dto.municipalityCode },
      include: { department: true },
    });
    if (!municipality) {
      throw new BadRequestException('El municipio seleccionado no existe.');
    }

    const publicToken = this.publicTokenFor(dto.idempotencyKey);
    const publicTokenHash = sha256(publicToken);
    const now = new Date();
    let orderId: string;
    try {
      orderId = await this.prisma.$transaction(async (tx) => {
        const stockSnapshots = new Map<
          string,
          { stockBefore: number; unitCost: Prisma.Decimal | null }
        >();
        for (const item of quote.items) {
          const variant = await tx.productVariant.findUniqueOrThrow({
            where: { id: item.variantId },
            select: { costPrice: true },
          });
          const reserved = await tx.productVariant.updateMany({
            where: { id: item.variantId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (reserved.count !== 1) {
            throw new BadRequestException(
              `No hay existencias suficientes para ${item.productName}.`,
            );
          }
          const afterReserve = await tx.productVariant.findUniqueOrThrow({
            where: { id: item.variantId },
            select: { stock: true },
          });
          stockSnapshots.set(item.variantId, {
            stockBefore: afterReserve.stock + item.quantity,
            unitCost: variant.costPrice,
          });
        }

        const customer = await tx.customer.upsert({
          where: { phone: customerPhone },
          create: { fullName: normalized.customerName, phone: customerPhone },
          update: { fullName: normalized.customerName },
        });

        const created = await tx.order.create({
          data: {
            code: await this.generateOrderCode(tx),
            publicTokenHash,
            idempotencyKey: dto.idempotencyKey,
            requestHash,
            customerId: customer.id,
            customerName: normalized.customerName,
            customerPhone,
            municipalityCode: municipality.code,
            department: municipality.department.name,
            city: municipality.name,
            addressLine: normalized.addressLine,
            deliveryNotes: normalized.deliveryNotes,
            paymentMethodId: paymentMethod.id,
            paymentMethodCode: paymentMethod.code,
            paymentMethodName: paymentMethod.name,
            subtotal: quote.subtotal,
            discountTotal: quote.discountTotal,
            shippingCost: quote.shippingCost,
            total: quote.total,
            termsAcceptedAt: now,
            dataProcessingConsentAt: now,
            items: {
              create: quote.items.map((item) => ({
                variantId: item.variantId,
                productId: item.productId,
                productName: item.productName,
                productSlug: item.productSlug,
                variantName: item.variantName,
                sku: item.sku,
                unitListPrice: item.unitListPrice,
                unitDiscount: item.unitDiscount,
                unitFinalPrice: item.unitFinalPrice,
                unitCost: stockSnapshots.get(item.variantId)?.unitCost ?? null,
                quantity: item.quantity,
                lineTotal: item.lineTotal,
                promotionId: item.promotionId,
                promotionName: item.promotionName,
              })),
            },
            statusHistory: {
              create: {
                type: OrderEventType.ORDER_STATUS,
                toStatus: 'PENDING_CONFIRMATION',
                note: 'Pedido creado desde checkout.',
              },
            },
          },
        });

        await tx.inventoryMovement.createMany({
          data: quote.items.map((item) => {
            const snapshot = stockSnapshots.get(item.variantId);
            if (!snapshot) throw new BadRequestException('No se pudo reservar una variante.');
            return {
              variantId: item.variantId,
              type: InventoryMovementType.ORDER_RESERVED,
              quantity: -item.quantity,
              stockBefore: snapshot.stockBefore,
              stockAfter: snapshot.stockBefore - item.quantity,
              reason: 'Reserva por pedido creado en checkout',
              orderId: created.id,
            };
          }),
        });

        return created.id;
      });
    } catch (err: unknown) {
      // Dos envíos simultáneos del mismo checkout: el segundo choca con la clave única de
      // idempotencia y devuelve el pedido que creó el primero.
      if (isUniqueViolation(err)) {
        const replayed = await this.replayIdempotent(dto.idempotencyKey, requestHash);
        if (replayed) return replayed;
      }
      throw err;
    }

    return this.createdOrderDto(orderId, publicToken);
  }

  /**
   * Busca un pedido por código y teléfono de la compra y devuelve su seguimiento privado. Si no
   * coinciden los dos, responde siempre el mismo error, sin decir cuál dato falló.
   */
  async lookupOrder(dto: LookupOrderDto): Promise<LookupOrderResultDto> {
    const notFound = new NotFoundException('No encontramos un pedido con esos datos.');
    const code = dto.code.trim().toUpperCase();
    const phone = normalizeWhatsappNumber(dto.phone);
    if (!WHATSAPP_NUMBER_PATTERN.test(phone)) throw notFound;

    const order = await this.prisma.order.findUnique({
      where: { code },
      select: { customerPhone: true, idempotencyKey: true },
    });
    if (!order || order.customerPhone !== phone) throw notFound;
    return { trackingPath: `/seguimiento/${this.publicTokenFor(order.idempotencyKey)}` };
  }

  async trackPublic(token: string): Promise<PublicOrderTrackingDto> {
    const normalizedToken = token.trim();
    if (!/^[a-f0-9]{48}$/i.test(normalizedToken)) {
      throw new NotFoundException('No existe ese enlace de seguimiento.');
    }

    const order = await this.prisma.order.findUnique({
      where: { publicTokenHash: sha256(normalizedToken) },
      include: {
        shipping: { include: { carrier: true } },
        items: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw new NotFoundException('No existe ese enlace de seguimiento.');

    const trackingTemplate = order.shipping?.carrier?.trackingUrlTemplate ?? null;
    const trackingNumber = order.shipping?.trackingNumber ?? null;
    const cancelled = order.status === OrderStatus.CANCELLED;
    // El aviso vigente: el de cancelación si el pedido está cancelado; si no, el de "antes".
    const notice = await this.prisma.cancellationNotice.findFirst({
      where: {
        orderId: order.id,
        stage: cancelled ? CancellationNoticeStage.AFTER : CancellationNoticeStage.BEFORE,
        status: { in: [CancellationNoticeStatus.PENDING, CancellationNoticeStatus.SENT] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      notice: notice
        ? {
            stage: notice.stage,
            text: publicNoticeText(notice.case, notice.stage, order.code, notice.deadlineAt),
            deadlineAt: notice.deadlineAt,
          }
        : null,
      code: order.code,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethodName: order.paymentMethodName,
      items: order.items.map((item) => ({
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        unitFinalPrice: item.unitFinalPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
      })),
      subtotal: order.subtotal.toNumber(),
      discountTotal: order.discountTotal.toNumber(),
      shippingCost: order.shippingCost?.toNumber() ?? null,
      total: order.total.toNumber(),
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      cancelledAt: order.cancelledAt,
      shipping: order.shipping
        ? {
            method: order.shipping.method,
            status: order.shipping.status,
            carrierName: order.shipping.carrier?.name ?? null,
            trackingNumber,
            trackingUrl:
              trackingTemplate && trackingNumber
                ? trackingTemplate.replace('{tracking}', encodeURIComponent(trackingNumber))
                : null,
            dispatchedAt: order.shipping.dispatchedAt,
            deliveredAt: order.shipping.deliveredAt,
          }
        : null,
    };
  }

  async listAdmin(query: ListOrdersQueryDto): Promise<PaginatedAdminOrdersDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.OrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { code: { contains: escapeLike(q), mode: 'insensitive' } },
        { customerName: { contains: escapeLike(q), mode: 'insensitive' } },
        { customerPhone: { contains: escapeLike(q), mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items: items.map((order) => this.toListItem(order)), total };
  }

  async findAdmin(id: string, role: AdminRole): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    return this.toDetail(order, role);
  }

  async confirm(
    id: string,
    dto: ConfirmOrderDto,
    adminId: string,
    role: AdminRole,
  ): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    if (order.status !== OrderStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException('Solo se pueden confirmar pedidos pendientes.');
    }

    const nextShippingCost = dto.shippingCost ?? order.shippingCost?.toNumber() ?? null;
    if (nextShippingCost === null) {
      throw new BadRequestException('Registra el costo de envío cotizado antes de confirmar.');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.claimOrder(tx, order);
      await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CONFIRMED,
          confirmedAt: new Date(),
          shippingCost: nextShippingCost,
          total: this.totalWithShipping(order.subtotal, order.discountTotal, nextShippingCost),
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          type: OrderEventType.ORDER_STATUS,
          fromStatus: order.status,
          toStatus: OrderStatus.CONFIRMED,
          note: 'Pedido confirmado por la tienda.',
          changedById: adminId,
        },
      });
      await closePendingBeforeNotices(tx, id, [CancellationNoticeCase.UNCONFIRMED]);
    });

    return this.findAdmin(id, role);
  }

  async quoteShipping(
    id: string,
    dto: QuoteShippingDto,
    adminId: string,
    role: AdminRole,
  ): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('No se puede modificar el envío de este pedido.');
    }
    if (
      order.paymentStatus === PaymentStatus.PAID &&
      dto.shippingCost > (order.shippingCost?.toNumber() ?? 0)
    ) {
      throw new BadRequestException(
        'No se puede aumentar el envío mientras el pedido esté pagado.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.claimOrder(tx, order);
      await tx.order.update({
        where: { id },
        data: {
          shippingCost: dto.shippingCost,
          total: this.totalWithShipping(order.subtotal, order.discountTotal, dto.shippingCost),
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          type: OrderEventType.SHIPPING,
          note: `Costo de envío cotizado: ${cop(dto.shippingCost)}.`,
          changedById: adminId,
        },
      });
    });

    return this.findAdmin(id, role);
  }

  async changeStatus(
    id: string,
    dto: ChangeOrderStatusDto,
    adminId: string,
    role: AdminRole,
  ): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    if (dto.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Usa la acción de cancelar para liberar las existencias.');
    }
    if (dto.status === OrderStatus.CONFIRMED) {
      throw new BadRequestException('Usa la acción de confirmar pedido.');
    }
    if (dto.status === OrderStatus.SHIPPED || dto.status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'El despacho y la entrega se registran en la sección de envío del pedido.',
      );
    }
    if (!NEXT_STATUSES[order.status].includes(dto.status)) {
      throw new BadRequestException(
        `No se puede pasar de "${ORDER_STATUS_NAMES[order.status]}" a "${ORDER_STATUS_NAMES[dto.status]}".`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.claimOrder(tx, order);
      await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          type: OrderEventType.ORDER_STATUS,
          fromStatus: order.status,
          toStatus: dto.status,
          note: dto.note?.trim() || null,
          changedById: adminId,
        },
      });
    });

    return this.findAdmin(id, role);
  }

  async upsertShipping(
    id: string,
    dto: UpsertOrderShippingDto,
    adminId: string,
    role: AdminRole,
  ): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { shipping: true },
    });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede registrar el envío de un pedido cancelado.');
    }
    const currentShippingStatus = order.shipping?.status ?? ShippingStatus.NOT_SHIPPED;
    if (!NEXT_SHIPPING_STATUSES[currentShippingStatus].includes(dto.status)) {
      throw new BadRequestException(
        `El envío no puede pasar de "${SHIPPING_STATUS_NAMES[currentShippingStatus]}" a "${SHIPPING_STATUS_NAMES[dto.status]}".`,
      );
    }
    if (
      order.status === OrderStatus.PENDING_CONFIRMATION &&
      dto.status !== ShippingStatus.NOT_SHIPPED
    ) {
      throw new BadRequestException('Primero confirma el pedido antes de despacharlo.');
    }

    const method = dto.method ?? order.shipping?.method ?? ShippingMethod.CARRIER;
    const isLocal = method === ShippingMethod.LOCAL;
    // La entrega local no lleva transportadora ni guía.
    const carrierId = isLocal
      ? null
      : dto.carrierId === undefined
        ? (order.shipping?.carrierId ?? null)
        : dto.carrierId;
    const trackingNumber = isLocal
      ? null
      : dto.trackingNumber === undefined
        ? (order.shipping?.trackingNumber ?? null)
        : dto.trackingNumber?.trim() || null;
    const carrierCost =
      dto.carrierCost === undefined
        ? (order.shipping?.carrierCost?.toNumber() ?? null)
        : dto.carrierCost;
    const notes =
      dto.notes === undefined ? (order.shipping?.notes ?? null) : dto.notes?.trim() || null;
    const now = new Date();
    const dispatchedAt =
      dto.dispatchedAt === undefined
        ? (order.shipping?.dispatchedAt ??
          (dto.status === ShippingStatus.IN_TRANSIT || dto.status === ShippingStatus.DELIVERED
            ? now
            : null))
        : dto.dispatchedAt
          ? new Date(dto.dispatchedAt)
          : null;
    const deliveredAt =
      dto.deliveredAt === undefined
        ? (order.shipping?.deliveredAt ?? (dto.status === ShippingStatus.DELIVERED ? now : null))
        : dto.deliveredAt
          ? new Date(dto.deliveredAt)
          : null;

    if (
      !isLocal &&
      (dto.status === ShippingStatus.IN_TRANSIT || dto.status === ShippingStatus.DELIVERED) &&
      (!carrierId || !trackingNumber)
    ) {
      throw new BadRequestException('Para despachar registra transportadora y número de guía.');
    }
    if (dispatchedAt && deliveredAt && deliveredAt < dispatchedAt) {
      throw new BadRequestException('La fecha de entrega no puede ser anterior a la de despacho.');
    }

    let carrierName: string | null = null;
    if (carrierId) {
      const carrier = await this.prisma.carrier.findUnique({ where: { id: carrierId } });
      if (!carrier) throw new BadRequestException('La transportadora seleccionada no existe.');
      // Una transportadora desactivada no se puede elegir de nuevo, pero el envío que ya la usa
      // se puede seguir corrigiendo.
      if (!carrier.isActive && carrier.id !== order.shipping?.carrierId) {
        throw new BadRequestException('La transportadora no está activa.');
      }
      carrierName = carrier.name;
    }

    // El estado del pedido solo avanza: despachado con el envío en tránsito o con novedad,
    // entregado con el envío entregado.
    const nextOrderStatus =
      dto.status === ShippingStatus.DELIVERED
        ? OrderStatus.DELIVERED
        : (dto.status === ShippingStatus.IN_TRANSIT || dto.status === ShippingStatus.INCIDENT) &&
            (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PREPARING)
          ? OrderStatus.SHIPPED
          : order.status;
    const shouldRegisterCodPayment =
      dto.status === ShippingStatus.DELIVERED &&
      order.paymentMethodCode === 'CASH_ON_DELIVERY' &&
      order.paymentStatus !== PaymentStatus.PAID &&
      order.paymentStatus !== PaymentStatus.REFUNDED;

    await this.prisma.$transaction(async (tx) => {
      await this.claimOrder(tx, order);
      await tx.shipping.upsert({
        where: { orderId: id },
        create: {
          orderId: id,
          method,
          carrierId,
          trackingNumber,
          carrierCost,
          status: dto.status,
          dispatchedAt,
          deliveredAt,
          notes,
        },
        update: {
          method,
          carrierId,
          trackingNumber,
          carrierCost,
          status: dto.status,
          dispatchedAt,
          deliveredAt,
          notes,
        },
      });
      await tx.order.update({
        where: { id },
        data: {
          status: nextOrderStatus,
          paymentStatus: shouldRegisterCodPayment ? PaymentStatus.PAID : order.paymentStatus,
          ...(shouldRegisterCodPayment && { paidAt: new Date() }),
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          type: OrderEventType.SHIPPING,
          fromStatus: order.shipping?.status ?? null,
          toStatus: dto.status,
          note: this.shippingEventNote(dto.status, carrierName, trackingNumber, isLocal),
          changedById: adminId,
        },
      });
      if (nextOrderStatus !== order.status) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            type: OrderEventType.ORDER_STATUS,
            fromStatus: order.status,
            toStatus: nextOrderStatus,
            note: 'Estado actualizado desde la gestión del envío.',
            changedById: adminId,
          },
        });
      }
      if (shouldRegisterCodPayment) {
        await tx.paymentRecord.create({
          data: {
            orderId: id,
            status: PaymentStatus.PAID,
            amount: order.total,
            note: 'Pago contra entrega registrado al marcar el envío como entregado.',
            recordedById: adminId,
          },
        });
      }
    });

    return this.findAdmin(id, role);
  }

  async updateItems(
    id: string,
    dto: UpdateOrderItemsDto,
    adminId: string,
    role: AdminRole,
  ): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    if (order.status !== OrderStatus.PENDING_CONFIRMATION) {
      throw new BadRequestException('Solo se pueden editar pedidos sin confirmar.');
    }

    const desiredItems = uniqueCartItems(dto.items);
    const existingByVariant = new Map(
      order.items.filter((item) => item.variantId).map((item) => [item.variantId as string, item]),
    );
    const desiredByVariant = new Map(desiredItems.map((item) => [item.variantId, item.quantity]));
    const finalItems: Array<{
      variantId: string | null;
      productId: string;
      productName: string;
      productSlug: string;
      variantName: string;
      sku: string;
      unitListPrice: number;
      unitDiscount: number;
      unitFinalPrice: number;
      unitCost: Prisma.Decimal | null;
      quantity: number;
      lineTotal: number;
      promotionId: string | null;
      promotionName: string | null;
    }> = [];

    const keptWithoutVariant: typeof order.items = [];
    const { maxUnitsPerProduct } = await this.settings.get();
    await this.prisma.$transaction(async (tx) => {
      await this.claimOrder(tx, order);
      for (const existing of order.items) {
        // Un producto cuya variante ya no existe se conserva tal cual: no se puede editar.
        if (!existing.variantId) {
          keptWithoutVariant.push(existing);
          continue;
        }
        const nextQuantity = desiredByVariant.get(existing.variantId) ?? 0;
        const delta = nextQuantity - existing.quantity;
        if (delta > 0) {
          const limit = await tx.productVariant.findUnique({
            where: { id: existing.variantId },
            select: { maxPerOrder: true },
          });
          const max = effectiveMaxPerOrder(limit?.maxPerOrder ?? null, maxUnitsPerProduct);
          if (max !== null && nextQuantity > max) {
            throw new BadRequestException(
              `${existing.productName} permite máximo ${max} unidades por pedido.`,
            );
          }
          await this.reserveStock(tx, existing.variantId, delta, id);
        } else if (delta < 0) {
          await this.releaseStock(tx, existing.variantId, Math.abs(delta), id);
        }
        if (nextQuantity > 0) {
          finalItems.push({
            variantId: existing.variantId,
            productId: existing.productId,
            productName: existing.productName,
            productSlug: existing.productSlug,
            variantName: existing.variantName,
            sku: existing.sku,
            unitListPrice: existing.unitListPrice.toNumber(),
            unitDiscount: existing.unitDiscount.toNumber(),
            unitFinalPrice: existing.unitFinalPrice.toNumber(),
            unitCost: existing.unitCost,
            quantity: nextQuantity,
            lineTotal: existing.unitFinalPrice.toNumber() * nextQuantity,
            promotionId: existing.promotionId,
            promotionName: existing.promotionName,
          });
        }
      }

      for (const desired of desiredItems) {
        if (existingByVariant.has(desired.variantId)) continue;
        const variant = await tx.productVariant.findUnique({
          where: { id: desired.variantId },
          include: { product: true },
        });
        if (!variant || !variant.isActive || variant.product.status !== 'ACTIVE') {
          throw new BadRequestException('Uno o más productos agregados no están disponibles.');
        }
        const max = effectiveMaxPerOrder(variant.maxPerOrder, maxUnitsPerProduct);
        if (max !== null && desired.quantity > max) {
          throw new BadRequestException(
            `${variant.product.name} permite máximo ${max} unidades por pedido.`,
          );
        }
        await this.reserveStock(tx, desired.variantId, desired.quantity, id);
        const price = await this.pricing.priceVariantAt(desired.variantId, order.createdAt);
        finalItems.push({
          variantId: variant.id,
          productId: variant.productId,
          productName: variant.product.name,
          productSlug: variant.product.slug,
          variantName: variant.name,
          sku: variant.sku,
          unitListPrice: money(price.regularPrice),
          unitDiscount: money(price.discountAmount),
          unitFinalPrice: money(price.finalPrice),
          unitCost: variant.costPrice,
          quantity: desired.quantity,
          lineTotal: money(price.finalPrice * desired.quantity),
          promotionId: price.appliedPromotion?.promotionId ?? null,
          promotionName: price.appliedPromotion?.promotionName ?? null,
        });
      }

      for (const kept of keptWithoutVariant) {
        finalItems.push({
          variantId: null,
          productId: kept.productId,
          productName: kept.productName,
          productSlug: kept.productSlug,
          variantName: kept.variantName,
          sku: kept.sku,
          unitListPrice: kept.unitListPrice.toNumber(),
          unitDiscount: kept.unitDiscount.toNumber(),
          unitFinalPrice: kept.unitFinalPrice.toNumber(),
          unitCost: kept.unitCost,
          quantity: kept.quantity,
          lineTotal: kept.lineTotal.toNumber(),
          promotionId: kept.promotionId,
          promotionName: kept.promotionName,
        });
      }

      const subtotal = finalItems.reduce(
        (sum, item) => sum + item.unitListPrice * item.quantity,
        0,
      );
      const discountTotal = finalItems.reduce(
        (sum, item) => sum + item.unitDiscount * item.quantity,
        0,
      );
      const previousShipping = order.shippingCost?.toNumber() ?? null;
      const shippingCost = await this.shippingAfterEdit(
        tx,
        order.municipalityCode,
        subtotal - discountTotal,
        previousShipping,
      );
      const total = this.totalWithShipping(
        new Prisma.Decimal(subtotal),
        new Prisma.Decimal(discountTotal),
        shippingCost,
      );

      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.order.update({
        where: { id },
        data: {
          subtotal,
          discountTotal,
          shippingCost,
          total,
          items: {
            create: finalItems.map((item) => ({
              variantId: item.variantId,
              productId: item.productId,
              productName: item.productName,
              productSlug: item.productSlug,
              variantName: item.variantName,
              sku: item.sku,
              unitListPrice: item.unitListPrice,
              unitDiscount: item.unitDiscount,
              unitFinalPrice: item.unitFinalPrice,
              unitCost: item.unitCost,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
              promotionId: item.promotionId,
              promotionName: item.promotionName,
            })),
          },
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          type: OrderEventType.ITEMS_CHANGED,
          note: 'Productos del pedido actualizados antes de confirmar.',
          changedById: adminId,
        },
      });
      if (shippingCost !== previousShipping) {
        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            type: OrderEventType.SHIPPING,
            note: `Envío recalculado al editar: ${shippingLabel(shippingCost)}.`,
            changedById: adminId,
          },
        });
      }
    });

    return this.findAdmin(id, role);
  }

  async cancel(
    id: string,
    dto: CancelOrderDto,
    adminId: string,
    role: AdminRole,
  ): Promise<AdminOrderDto> {
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Escribe el motivo de la cancelación.');
    }
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('El pedido ya esta cancelado.');
    }
    if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('No se puede cancelar un pedido despachado o entregado.');
    }
    // Nunca debe quedar un pedido cancelado con el pago verificado: primero se registra la
    // devolución y después se cancela (decisión del 2026-10-15, Q-05).
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException(
        'Este pedido tiene el pago verificado. Registra primero la devolución del dinero y después cancélalo.',
      );
    }
    if (role !== AdminRole.ADMIN && !this.staffCanCancelRejected(order)) {
      throw new ForbiddenException(
        'El personal solo puede cancelar por pago no demostrado vencido.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Evita liberar dos veces las existencias si el pedido se cancela a la vez desde dos lugares.
      await this.claimOrder(tx, order);
      for (const item of order.items) {
        if (item.variantId) await this.releaseStock(tx, item.variantId, item.quantity, id);
      }
      await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          type: OrderEventType.ORDER_STATUS,
          fromStatus: order.status,
          toStatus: OrderStatus.CANCELLED,
          note: reason,
          changedById: adminId,
        },
      });
      await closePendingBeforeNotices(tx, id, ALL_NOTICE_CASES);
      // Pago no demostrado tras el plazo de aclaración: aviso de cancelación al cliente.
      const deadline = this.clarificationDeadline(order);
      if (deadline && deadline <= new Date()) {
        await createNotice(tx, {
          order,
          noticeCase: CancellationNoticeCase.PAYMENT_NOT_PROVEN,
          stage: CancellationNoticeStage.AFTER,
          deadlineAt: deadline,
        });
      }
    });

    return this.findAdmin(id, role);
  }

  async registerPaymentReceived(
    id: string,
    dto: RegisterPaymentReceivedDto,
    adminId: string,
    role: AdminRole,
  ): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede registrar pago en un pedido cancelado.');
    }
    if (order.paymentMethodCode === 'CASH_ON_DELIVERY') {
      throw new BadRequestException('El contra entrega se marca pagado al entregar el pedido.');
    }
    if (
      order.paymentStatus === PaymentStatus.PAID ||
      order.paymentStatus === PaymentStatus.REFUNDED
    ) {
      throw new BadRequestException('Este pedido ya no admite registro de comprobante.');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.claimOrder(tx, order);
      await tx.order.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.AWAITING_VERIFICATION, paymentRejectedAt: null },
      });
      await tx.paymentRecord.create({
        data: {
          orderId: id,
          status: PaymentStatus.AWAITING_VERIFICATION,
          amount: order.total,
          reference: dto.reference?.trim() || null,
          note: dto.note?.trim() || 'Comprobante recibido por WhatsApp.',
          recordedById: adminId,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          type: OrderEventType.PAYMENT_STATUS,
          fromStatus: order.paymentStatus,
          toStatus: PaymentStatus.AWAITING_VERIFICATION,
          note: 'Comprobante de pago recibido por WhatsApp.',
          changedById: adminId,
        },
      });
      await closePendingBeforeNotices(tx, id, [
        CancellationNoticeCase.NO_PAYMENT_PROOF,
        CancellationNoticeCase.PAYMENT_NOT_PROVEN,
      ]);
    });

    return this.findAdmin(id, role);
  }

  async verifyPayment(id: string, dto: VerifyPaymentDto, adminId: string): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede verificar pago en un pedido cancelado.');
    }
    if (order.paymentMethodCode === 'CASH_ON_DELIVERY') {
      throw new BadRequestException('El contra entrega se registra al marcar el pedido entregado.');
    }
    if (order.paymentStatus !== PaymentStatus.AWAITING_VERIFICATION) {
      throw new BadRequestException('Solo se verifican pedidos con comprobante recibido.');
    }

    const received = new Prisma.Decimal(dto.amount ?? order.total);
    const incomplete = received.lessThan(order.total);
    const excess = received.minus(order.total);
    if (excess.greaterThan(0) && (dto.note?.trim().length ?? 0) < 3) {
      throw new BadRequestException('Escribe una nota sobre el excedente por devolver.');
    }
    const status = incomplete ? PaymentStatus.REJECTED : PaymentStatus.PAID;
    const note = incomplete
      ? `Pago incompleto: recibido ${cop(received.toNumber())} de ${cop(order.total.toNumber())}. ${dto.note?.trim() ?? ''}`.trim()
      : excess.greaterThan(0)
        ? `Recibido ${cop(received.toNumber())}. Excedente por devolver: ${cop(excess.toNumber())}. ${dto.note!.trim()}`
        : dto.note?.trim() || 'Pago verificado por la propietaria.';
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await this.claimOrder(tx, order);
      await tx.order.update({
        where: { id },
        data: {
          paymentStatus: status,
          paymentRejectedAt: incomplete ? now : null,
          paidAt: incomplete ? null : now,
        },
      });
      await tx.paymentRecord.create({
        data: {
          orderId: id,
          status,
          amount: incomplete ? received : order.total,
          reference: dto.reference?.trim() || null,
          note,
          recordedById: adminId,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          type: OrderEventType.PAYMENT_STATUS,
          fromStatus: order.paymentStatus,
          toStatus: status,
          note,
          changedById: adminId,
        },
      });
      await closePendingBeforeNotices(tx, id, [
        CancellationNoticeCase.NO_PAYMENT_PROOF,
        ...(!incomplete ? [CancellationNoticeCase.PAYMENT_NOT_PROVEN] : []),
      ]);
    });

    return this.findAdmin(id, AdminRole.ADMIN);
  }

  async rejectPayment(id: string, dto: RejectPaymentDto, adminId: string): Promise<AdminOrderDto> {
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Escribe el motivo del rechazo.');
    }
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('No se puede rechazar pago en un pedido cancelado.');
    }
    if (order.paymentMethodCode === 'CASH_ON_DELIVERY') {
      throw new BadRequestException('El contra entrega no se rechaza por comprobante.');
    }
    if (order.paymentStatus !== PaymentStatus.AWAITING_VERIFICATION) {
      throw new BadRequestException(
        'Solo se rechazan pagos con comprobante pendiente de verificar.',
      );
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.claimOrder(tx, order);
      await tx.order.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.REJECTED, paymentRejectedAt: now },
      });
      await tx.paymentRecord.create({
        data: {
          orderId: id,
          status: PaymentStatus.REJECTED,
          amount: 0,
          note: reason,
          recordedById: adminId,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          type: OrderEventType.PAYMENT_STATUS,
          fromStatus: order.paymentStatus,
          toStatus: PaymentStatus.REJECTED,
          note: reason,
          changedById: adminId,
        },
      });
    });

    return this.findAdmin(id, AdminRole.ADMIN);
  }

  async refundPayment(id: string, dto: RefundPaymentDto, adminId: string): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('No existe ese pedido.');
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        'Solo se puede registrar una devolución sobre un pago verificado.',
      );
    }
    const note = dto.note.trim();
    if (note.length < 3) {
      throw new BadRequestException('Escribe el motivo o soporte de la devolución.');
    }
    const paid = await this.prisma.paymentRecord.aggregate({
      where: { orderId: id, status: PaymentStatus.PAID },
      _sum: { amount: true },
    });
    const paidAmount = paid._sum.amount?.toNumber() ?? 0;
    if (dto.amount > paidAmount) {
      throw new BadRequestException(
        `La devolución no puede superar lo pagado (${cop(paidAmount)}).`,
      );
    }
    if (!new Prisma.Decimal(dto.amount).equals(paidAmount)) {
      throw new BadRequestException(`Solo se permiten devoluciones totales (${cop(paidAmount)}).`);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.claimOrder(tx, order);
      await tx.order.update({
        where: { id },
        data: { paymentStatus: PaymentStatus.REFUNDED },
      });
      await tx.paymentRecord.create({
        data: {
          orderId: id,
          status: PaymentStatus.REFUNDED,
          amount: dto.amount,
          reference: dto.reference?.trim() || null,
          note,
          recordedById: adminId,
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          type: OrderEventType.PAYMENT_STATUS,
          fromStatus: order.paymentStatus,
          toStatus: PaymentStatus.REFUNDED,
          note,
          changedById: adminId,
        },
      });
    });

    return this.findAdmin(id, AdminRole.ADMIN);
  }

  private toListItem(
    order: Prisma.OrderGetPayload<{ include: { _count: { select: { items: true } } } }>,
  ): AdminOrderListItemDto {
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      paymentStatus: order.paymentStatus,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      city: order.city,
      department: order.department,
      paymentMethodName: order.paymentMethodName,
      subtotal: order.subtotal.toNumber(),
      discountTotal: order.discountTotal.toNumber(),
      shippingCost: order.shippingCost?.toNumber() ?? null,
      total: order.total.toNumber(),
      itemCount: order._count.items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toDetail(order: OrderDetail, role: AdminRole): AdminOrderDto {
    const trackingTemplate = order.shipping?.carrier?.trackingUrlTemplate ?? null;
    const trackingNumber = order.shipping?.trackingNumber ?? null;
    return {
      ...this.toListItem(order),
      municipalityCode: order.municipalityCode,
      addressLine: order.addressLine,
      deliveryNotes: order.deliveryNotes,
      paymentMethodCode: order.paymentMethodCode,
      confirmedAt: order.confirmedAt,
      trackingUrl: this.trackingUrlFor(this.publicTokenFor(order.idempotencyKey)),
      paymentRejectedAt: order.paymentRejectedAt,
      paymentClarificationDeadline: this.clarificationDeadline(order),
      staffCanCancel: this.staffCanCancelRejected(order),
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      items: order.items.map((item) => ({
        id: item.id,
        variantId: item.variantId,
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        variantName: item.variantName,
        sku: item.sku,
        unitListPrice: item.unitListPrice.toNumber(),
        unitDiscount: item.unitDiscount.toNumber(),
        unitFinalPrice: item.unitFinalPrice.toNumber(),
        unitCost: role === AdminRole.ADMIN ? (item.unitCost?.toNumber() ?? null) : null,
        quantity: item.quantity,
        lineTotal: item.lineTotal.toNumber(),
        promotionId: item.promotionId,
        promotionName: item.promotionName,
        createdAt: item.createdAt,
      })),
      events: order.statusHistory.map((event) => ({
        id: event.id,
        type: event.type,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        changedById: event.changedById,
        createdAt: event.createdAt,
      })),
      paymentRecords: order.paymentRecords.map((record) => ({
        id: record.id,
        status: record.status,
        amount: record.amount.toNumber(),
        reference: record.reference,
        note: record.note,
        recordedById: record.recordedById,
        createdAt: record.createdAt,
      })),
      shipping: order.shipping
        ? {
            id: order.shipping.id,
            method: order.shipping.method,
            carrierId: order.shipping.carrierId,
            carrierName: order.shipping.carrier?.name ?? null,
            carrierTrackingUrlTemplate: trackingTemplate,
            trackingNumber,
            trackingUrl:
              trackingTemplate && trackingNumber
                ? trackingTemplate.replace('{tracking}', encodeURIComponent(trackingNumber))
                : null,
            carrierCost: order.shipping.carrierCost?.toNumber() ?? null,
            status: order.shipping.status,
            dispatchedAt: order.shipping.dispatchedAt,
            deliveredAt: order.shipping.deliveredAt,
            notes: order.shipping.notes,
            createdAt: order.shipping.createdAt,
            updatedAt: order.shipping.updatedAt,
          }
        : null,
    };
  }

  private shippingEventNote(
    status: ShippingStatus,
    carrierName: string | null,
    trackingNumber: string | null,
    isLocal: boolean,
  ): string {
    if (isLocal && status === ShippingStatus.IN_TRANSIT) return 'Pedido en camino (entrega local).';
    if (status === ShippingStatus.NOT_SHIPPED) return 'Envío registrado como sin despachar.';
    if (status === ShippingStatus.IN_TRANSIT) {
      return `Pedido despachado${carrierName ? ` con ${carrierName}` : ''}${
        trackingNumber ? `, guía ${trackingNumber}` : ''
      }.`;
    }
    if (status === ShippingStatus.DELIVERED) return 'Envío marcado como entregado.';
    return 'Novedad registrada en el envío.';
  }

  private totalWithShipping(
    subtotal: Prisma.Decimal,
    discountTotal: Prisma.Decimal,
    shippingCost: number | null,
  ): number {
    return subtotal
      .minus(discountTotal)
      .plus(shippingCost ?? 0)
      .toNumber();
  }

  /**
   * Envío de un pedido sin confirmar después de editarlo (decisión del 2026-10-13): se recalcula
   * con la regla del checkout (gratis nacional, gratis por monto mínimo, tarifa del municipio) y la
   * configuración vigente. Si ninguna regla da un valor, se conserva el costo que la tienda cotizó
   * a mano; si el envío era gratis y deja de serlo, vuelve a quedar por confirmar.
   */
  private async shippingAfterEdit(
    tx: Prisma.TransactionClient,
    municipalityCode: string,
    productsTotal: number,
    previous: number | null,
  ): Promise<number | null> {
    const settings = await this.settings.get();
    const rate = await tx.municipalShippingRate.findUnique({ where: { municipalityCode } });
    const computed = this.checkoutShippingCost(
      productsTotal,
      settings.nationalFreeShipping,
      settings.freeShippingThreshold,
      rate?.amount.toNumber() ?? null,
    );
    if (computed !== null) return computed;
    return previous !== null && previous > 0 ? previous : null;
  }

  private checkoutShippingCost(
    productsTotal: number,
    nationalFreeShipping: boolean,
    freeShippingThreshold: number | null,
    municipalRate: number | null,
  ): number | null {
    if (nationalFreeShipping) return 0;
    if (freeShippingThreshold !== null && productsTotal >= freeShippingThreshold) return 0;
    return municipalRate;
  }

  /**
   * Cancelación automática por plazo vencido (decisiones del 2026-10-09): pedido sin confirmar a
   * las 48 horas o confirmado sin comprobante a las 24 horas. Libera existencias, deja el motivo,
   * crea el aviso de cancelación y notifica al panel. Devuelve false si el pedido ya no está en ese
   * caso o cambió mientras se procesaba.
   */
  async autoCancel(
    orderId: string,
    noticeCase: CancellationNoticeCase,
    deadlineAt: Date,
    now = new Date(),
  ): Promise<boolean> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return false;
    const stillDue =
      noticeCase === CancellationNoticeCase.UNCONFIRMED
        ? order.status === OrderStatus.PENDING_CONFIRMATION
        : noticeCase === CancellationNoticeCase.NO_PAYMENT_PROOF &&
          (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PREPARING) &&
          order.paymentStatus === PaymentStatus.PENDING;
    if (!stillDue) return false;

    const hours = this.config.get(
      noticeCase === CancellationNoticeCase.UNCONFIRMED
        ? 'ORDER_PENDING_TTL_HOURS'
        : 'ORDER_UNPAID_TTL_HOURS',
      { infer: true },
    );
    const reason = autoCancelReason(noticeCase, hours);
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.claimOrder(tx, order);
        for (const item of order.items) {
          if (item.variantId) await this.releaseStock(tx, item.variantId, item.quantity, orderId);
        }
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.CANCELLED, cancelledAt: now, cancelReason: reason },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            type: OrderEventType.ORDER_STATUS,
            fromStatus: order.status,
            toStatus: OrderStatus.CANCELLED,
            note: reason,
          },
        });
        await closePendingBeforeNotices(tx, orderId, ALL_NOTICE_CASES, now);
        await createNotice(tx, {
          order,
          noticeCase,
          stage: CancellationNoticeStage.AFTER,
          deadlineAt,
        });
        await tx.adminNotification.create({
          data: {
            type: AdminNotificationType.ORDER_AUTO_CANCELLED,
            orderId,
            title: `Pedido ${order.code} cancelado automáticamente`,
            body: reason,
          },
        });
      });
      return true;
    } catch (err: unknown) {
      if (err instanceof ConflictException) return false;
      throw err;
    }
  }

  /**
   * Bloqueo optimista: confirma, dentro de la transacción, que el pedido sigue en el estado en que
   * se leyó. Si otra operación lo cambió entretanto (otra edición, una confirmación, otra
   * cancelación), se rechaza para no reservar ni liberar existencias sobre datos desactualizados.
   */
  private async claimOrder(
    tx: Prisma.TransactionClient,
    order: { id: string; status: OrderStatus; updatedAt: Date },
  ): Promise<void> {
    const { count } = await tx.order.updateMany({
      where: { id: order.id, status: order.status, updatedAt: order.updatedAt },
      data: { updatedAt: new Date() },
    });
    if (count !== 1) {
      throw new ConflictException(
        'El pedido cambió mientras se procesaba. Vuelve a cargarlo e inténtalo de nuevo.',
      );
    }
  }

  private async reserveStock(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    const reserved = await tx.productVariant.updateMany({
      where: { id: variantId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (reserved.count !== 1) {
      throw new BadRequestException('No hay existencias suficientes para actualizar el pedido.');
    }
    // El stock se lee después del decremento atómico para que el historial cuadre aunque haya
    // movimientos simultáneos.
    const after = await tx.productVariant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    });
    await tx.inventoryMovement.create({
      data: {
        variantId,
        type: InventoryMovementType.ORDER_RESERVED,
        quantity: -quantity,
        stockBefore: after.stock + quantity,
        stockAfter: after.stock,
        reason: 'Reserva por edicion de pedido',
        orderId,
      },
    });
  }

  private async releaseStock(
    tx: Prisma.TransactionClient,
    variantId: string,
    quantity: number,
    orderId: string,
  ): Promise<void> {
    const updated = await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: { increment: quantity } },
      select: { stock: true },
    });
    await tx.inventoryMovement.create({
      data: {
        variantId,
        type: InventoryMovementType.ORDER_RELEASED,
        quantity,
        stockBefore: updated.stock - quantity,
        stockAfter: updated.stock,
        reason: 'Liberacion de existencias del pedido',
        orderId,
      },
    });
  }

  /** Fin del plazo de aclaración de un pago rechazado (ORDER_PAYMENT_CLARIFICATION_HOURS). */
  private clarificationDeadline(order: {
    paymentStatus: PaymentStatus;
    paymentRejectedAt: Date | null;
  }): Date | null {
    if (order.paymentStatus !== PaymentStatus.REJECTED || !order.paymentRejectedAt) return null;
    const hours = this.config.get('ORDER_PAYMENT_CLARIFICATION_HOURS', { infer: true });
    return new Date(order.paymentRejectedAt.getTime() + hours * 60 * 60 * 1000);
  }

  private staffCanCancelRejected(order: {
    paymentStatus: PaymentStatus;
    paymentRejectedAt: Date | null;
  }): boolean {
    if (order.paymentStatus !== PaymentStatus.REJECTED || !order.paymentRejectedAt) return false;
    const hours = this.config.get('ORDER_PAYMENT_CLARIFICATION_HOURS', { infer: true });
    if (hours === 0) return false;
    return Date.now() - order.paymentRejectedAt.getTime() >= hours * 60 * 60 * 1000;
  }

  private async availablePaymentMethods(
    municipalityCode: string | undefined,
    total: number,
  ): Promise<AvailablePaymentMethodDto[]> {
    const methods = await this.prisma.paymentMethod.findMany({
      where: { isActive: true },
      include: { cities: true },
      orderBy: { position: 'asc' },
    });

    return methods
      .filter((method) => {
        if (method.maxOrderTotal !== null && total > method.maxOrderTotal.toNumber()) return false;
        if (!method.restrictToCities) return true;
        if (!municipalityCode) return false;
        return method.cities.some((city) => city.municipalityCode === municipalityCode);
      })
      .map(toPaymentMethodDto);
  }

  private async ensurePaymentMethod(
    paymentMethodId: string,
    municipalityCode: string,
    total: number,
  ): Promise<MethodForCheckout> {
    const available = await this.availablePaymentMethods(municipalityCode, total);
    if (!available.some((method) => method.id === paymentMethodId)) {
      throw new BadRequestException('El método de pago no está disponible para este pedido.');
    }
    return this.prisma.paymentMethod.findUniqueOrThrow({
      where: { id: paymentMethodId },
      include: { cities: true },
    });
  }

  /**
   * Token del enlace privado de seguimiento. Se deriva con HMAC y un secreto del servidor, así que
   * no se puede calcular a partir de los datos del pedido, y un reintento obtiene el mismo enlace.
   */
  private publicTokenFor(idempotencyKey: string): string {
    return createHmac('sha256', this.config.get('TRACKING_TOKEN_SECRET', { infer: true }))
      .update(`order-tracking:${idempotencyKey}`)
      .digest('hex')
      .slice(0, 48);
  }

  /** Enlace completo de seguimiento (PUBLIC_SITE_URL + /seguimiento/<token>). */
  private trackingUrlFor(publicToken: string): string {
    const site = this.config.get('PUBLIC_SITE_URL', { infer: true }).replace(/\/$/, '');
    return `${site}/seguimiento/${publicToken}`;
  }

  /** Si ya existe un pedido con esa clave, lo devuelve; si la clave se usó con otros datos, falla. */
  private async replayIdempotent(
    idempotencyKey: string,
    requestHash: string,
  ): Promise<CreatedOrderDto | null> {
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey },
      select: { id: true, requestHash: true },
    });
    if (!existing) return null;
    if (existing.requestHash !== requestHash) {
      throw new ConflictException('La clave de idempotencia ya fue usada con otro pedido.');
    }
    return this.createdOrderDto(existing.id, this.publicTokenFor(idempotencyKey));
  }

  private itemIssue(
    quantity: number,
    variant: { stock: number; maxPerOrder: number | null },
  ): CartQuoteItemDto['issue'] {
    if (variant.maxPerOrder !== null && quantity > variant.maxPerOrder) return 'OVER_MAX_PER_ORDER';
    if (quantity > variant.stock) return 'INSUFFICIENT_STOCK';
    return null;
  }

  private async generateOrderCode(tx: Prisma.TransactionClient): Promise<string> {
    // Fecha del pedido en hora de Colombia (AAMMDD), no en UTC.
    const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })
      .format(new Date())
      .slice(2)
      .replace(/-/g, '');
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = `SB-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await tx.order.findUnique({ where: { code }, select: { id: true } });
      if (!exists) return code;
    }
    throw new ConflictException('No se pudo generar un código de pedido único.');
  }

  /** Respuesta del checkout, armada con el pedido tal como quedó registrado. */
  private async createdOrderDto(orderId: string, publicToken: string): Promise<CreatedOrderDto> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });
    const info = await this.settings.getPublicInfo();
    const shippingCost = order.shippingCost?.toNumber() ?? null;
    const summary = {
      items: order.items.map((item) => ({
        productName: item.productName,
        variantName: item.variantName,
        quantity: item.quantity,
        unitFinalPrice: item.unitFinalPrice.toNumber(),
        lineTotal: item.lineTotal.toNumber(),
      })),
      subtotal: order.subtotal.toNumber(),
      discountTotal: order.discountTotal.toNumber(),
      shippingCost,
      total: order.total.toNumber(),
      shippingLabel: shippingLabel(shippingCost),
      paymentMethodName: order.paymentMethodName,
    };
    const trackingUrl = this.trackingUrlFor(publicToken);
    const whatsappMessage = buildWhatsappMessage(order, summary, trackingUrl);
    return {
      id: order.id,
      code: order.code,
      publicToken,
      trackingPath: `/seguimiento/${publicToken}`,
      trackingUrl,
      whatsappMessage,
      summary,
      whatsappUrl: info.whatsappNumber
        ? `https://wa.me/${info.whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`
        : null,
    };
  }
}
