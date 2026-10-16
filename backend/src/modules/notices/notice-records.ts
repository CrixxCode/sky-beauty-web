import {
  AdminNotificationType,
  CancellationNoticeCase,
  CancellationNoticeStage,
  CancellationNoticeStatus,
  Prisma,
} from '../../generated/prisma/client';

/**
 * Mensajes aprobados el 2026-10-09 (decisión "Avisos de cancelación"). {nombre} y {código} son el
 * nombre del cliente y el código del pedido. Se envían tal cual por WhatsApp.
 */
const MESSAGES: Record<CancellationNoticeCase, Record<CancellationNoticeStage, string>> = {
  UNCONFIRMED: {
    BEFORE:
      'Hola, {nombre}. Tu pedido {código} se cancelará en 1 hora. Motivo: no hemos recibido la confirmación de tu pedido por WhatsApp. Si aún lo quieres, escríbenos por este chat.',
    AFTER:
      'Hola, {nombre}. Tu pedido {código} fue cancelado. Motivo: no recibimos la confirmación de tu pedido por WhatsApp. Si aún quieres los productos, puedes hacer un nuevo pedido en la tienda.',
  },
  NO_PAYMENT_PROOF: {
    BEFORE:
      'Hola, {nombre}. Tu pedido {código} se cancelará en 1 hora. Motivo: no hemos recibido el comprobante de pago. Envíanoslo por este chat para conservar tu pedido.',
    AFTER:
      'Hola, {nombre}. Tu pedido {código} fue cancelado. Motivo: no recibimos el comprobante de pago. Si ya pagaste, ponte en contacto con el personal.',
  },
  PAYMENT_NOT_PROVEN: {
    BEFORE:
      'Hola, {nombre}. Tu pedido {código} se cancelará en 1 hora. Motivo: pago no verificado, ponte en contacto con el personal.',
    AFTER:
      'Hola, {nombre}. Tu pedido {código} fue cancelado. Motivo: pago no verificado. Si tienes alguna duda, ponte en contacto con el personal.',
  },
};

export const NOTICE_CASE_NAMES: Record<CancellationNoticeCase, string> = {
  UNCONFIRMED: 'Sin confirmar',
  NO_PAYMENT_PROOF: 'Sin comprobante de pago',
  PAYMENT_NOT_PROVEN: 'Pago no demostrado',
};

/** Motivo que queda en el pedido cuando el sistema lo cancela por plazo. */
export function autoCancelReason(noticeCase: CancellationNoticeCase, hours: number): string {
  return noticeCase === CancellationNoticeCase.UNCONFIRMED
    ? `Cancelación automática: el pedido siguió sin confirmar ${hours} horas después de creado.`
    : `Cancelación automática: no se recibió el comprobante de pago ${hours} horas después de confirmado.`;
}

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

/** Mensaje para WhatsApp, con el nombre del cliente y el código del pedido. */
export function whatsappNoticeMessage(
  noticeCase: CancellationNoticeCase,
  stage: CancellationNoticeStage,
  customerName: string,
  code: string,
): string {
  return MESSAGES[noticeCase][stage].replace('{nombre}', customerName).replace('{código}', code);
}

/**
 * Texto para la página de seguimiento: el mismo mensaje sin el saludo con el nombre (el
 * seguimiento no muestra datos del cliente) y con la fecha exacta en lugar de "en 1 hora".
 */
export function publicNoticeText(
  noticeCase: CancellationNoticeCase,
  stage: CancellationNoticeStage,
  code: string,
  deadlineAt: Date,
): string {
  const date = dateFormatter.format(deadlineAt);
  return (
    MESSAGES[noticeCase][stage]
      .replace('Hola, {nombre}. ', '')
      .replace('{código}', code)
      // La hora termina en "a. m." o "p. m.": no se agrega un segundo punto.
      .replace('en 1 hora.', date.endsWith('.') ? `el ${date}` : `el ${date}.`)
  );
}

export function formatNoticeDate(value: Date): string {
  return dateFormatter.format(value);
}

/**
 * Crea un aviso pendiente si no existe ya (la fecha límite lo identifica) y una notificación para
 * el panel. Devuelve false si ya existía.
 */
export async function createNotice(
  tx: Prisma.TransactionClient,
  input: {
    order: { id: string; code: string; customerName: string };
    noticeCase: CancellationNoticeCase;
    stage: CancellationNoticeStage;
    deadlineAt: Date;
  },
): Promise<boolean> {
  const { order, noticeCase, stage, deadlineAt } = input;
  const existing = await tx.cancellationNotice.findUnique({
    where: {
      orderId_case_stage_deadlineAt: { orderId: order.id, case: noticeCase, stage, deadlineAt },
    },
    select: { id: true },
  });
  if (existing) return false;

  const notice = await tx.cancellationNotice.create({
    data: {
      orderId: order.id,
      case: noticeCase,
      stage,
      deadlineAt,
      message: whatsappNoticeMessage(noticeCase, stage, order.customerName, order.code),
    },
  });
  await tx.adminNotification.create({
    data: {
      type: AdminNotificationType.NOTICE_PENDING,
      orderId: order.id,
      noticeId: notice.id,
      title:
        stage === CancellationNoticeStage.BEFORE
          ? `Aviso por enviar: pedido ${order.code}`
          : `Aviso de cancelación por enviar: pedido ${order.code}`,
      body:
        stage === CancellationNoticeStage.BEFORE
          ? `${NOTICE_CASE_NAMES[noticeCase]}. El pedido se cancela el ${formatNoticeDate(deadlineAt)}. Envía el aviso al cliente por WhatsApp.`
          : `${NOTICE_CASE_NAMES[noticeCase]}. El pedido fue cancelado. Envía el aviso al cliente por WhatsApp.`,
    },
  });
  return true;
}

/**
 * Cierra los avisos "antes" que siguen pendientes de un pedido: vencidos si su plazo ya pasó
 * (nadie los envió a tiempo) o descartados si el pedido ya no está en ese caso.
 */
export async function closePendingBeforeNotices(
  tx: Prisma.TransactionClient,
  orderId: string,
  cases: CancellationNoticeCase[],
  now = new Date(),
): Promise<void> {
  const where = {
    orderId,
    stage: CancellationNoticeStage.BEFORE,
    status: CancellationNoticeStatus.PENDING,
    case: { in: cases },
  };
  await tx.cancellationNotice.updateMany({
    where: { ...where, deadlineAt: { lte: now } },
    data: { status: CancellationNoticeStatus.EXPIRED, resolvedAt: now },
  });
  await tx.cancellationNotice.updateMany({
    where: { ...where, deadlineAt: { gt: now } },
    data: { status: CancellationNoticeStatus.DISCARDED, resolvedAt: now },
  });
}

export const ALL_NOTICE_CASES = Object.values(CancellationNoticeCase);
