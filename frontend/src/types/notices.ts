export type NoticeCase = 'UNCONFIRMED' | 'NO_PAYMENT_PROOF' | 'PAYMENT_NOT_PROVEN';
export type NoticeStage = 'BEFORE' | 'AFTER';
export type NoticeStatus = 'PENDING' | 'SENT' | 'EXPIRED' | 'DISCARDED';

/** Aviso de cancelación para enviar al cliente por WhatsApp (GET /admin/notices). */
export interface CancellationNotice {
  kind: 'CANCELLATION' | 'ORDER_UPDATE';
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  case: NoticeCase | null;
  type: 'ORDER_CONFIRMED' | 'PAYMENT_VERIFIED' | 'ORDER_SHIPPED' | null;
  caseName: string;
  stage: NoticeStage | null;
  status: NoticeStatus;
  deadlineAt: string | null;
  message: string;
  whatsappUrl: string;
  createdAt: string;
  sentAt: string | null;
  sentByName: string | null;
}

export const NOTICE_STAGE_LABELS: Record<NoticeStage, string> = {
  BEFORE: 'Se cancelará en 1 hora',
  AFTER: 'Pedido cancelado',
};

export type AdminNotificationType =
  | 'NOTICE_PENDING'
  | 'ORDER_AUTO_CANCELLED'
  | 'ORDER_RECEIVED'
  | 'PAYMENT_PROOF_RECEIVED'
  | 'PAYMENT_REJECTED'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'SHIPPING_INCIDENT'
  | 'PAYMENT_EXCESS';

/** Notificación del panel (GET /admin/notifications). */
export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  body: string;
  href: string;
  orderId: string | null;
  noticeId: string | null;
  createdAt: string;
  read: boolean;
}

export interface AdminNotifications {
  unread: number;
  items: AdminNotification[];
}
