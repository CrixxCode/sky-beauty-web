export type NoticeCase = 'UNCONFIRMED' | 'NO_PAYMENT_PROOF' | 'PAYMENT_NOT_PROVEN';
export type NoticeStage = 'BEFORE' | 'AFTER';
export type NoticeStatus = 'PENDING' | 'SENT' | 'EXPIRED' | 'DISCARDED';

/** Aviso de cancelación para enviar al cliente por WhatsApp (GET /admin/notices). */
export interface CancellationNotice {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  case: NoticeCase;
  caseName: string;
  stage: NoticeStage;
  status: NoticeStatus;
  deadlineAt: string;
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

export type AdminNotificationType = 'NOTICE_PENDING' | 'ORDER_AUTO_CANCELLED';

/** Notificación del panel (GET /admin/notifications). */
export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  body: string;
  orderId: string | null;
  noticeId: string | null;
  createdAt: string;
  read: boolean;
}

export interface AdminNotifications {
  unread: number;
  items: AdminNotification[];
}
