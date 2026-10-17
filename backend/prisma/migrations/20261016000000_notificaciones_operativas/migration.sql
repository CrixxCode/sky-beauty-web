ALTER TYPE "AdminNotificationType" ADD VALUE 'ORDER_RECEIVED';
ALTER TYPE "AdminNotificationType" ADD VALUE 'PAYMENT_PROOF_RECEIVED';
ALTER TYPE "AdminNotificationType" ADD VALUE 'PAYMENT_REJECTED';
ALTER TYPE "AdminNotificationType" ADD VALUE 'LOW_STOCK';
ALTER TYPE "AdminNotificationType" ADD VALUE 'OUT_OF_STOCK';
ALTER TYPE "AdminNotificationType" ADD VALUE 'SHIPPING_INCIDENT';
ALTER TYPE "AdminNotificationType" ADD VALUE 'PAYMENT_EXCESS';

ALTER TABLE "AdminNotification" ADD COLUMN "adminOnly" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "AdminNotification_adminOnly_createdAt_idx" ON "AdminNotification"("adminOnly", "createdAt");

CREATE TYPE "OrderUpdateNoticeType" AS ENUM ('ORDER_CONFIRMED', 'PAYMENT_VERIFIED', 'ORDER_SHIPPED');
CREATE TABLE "OrderUpdateNotice" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "type" "OrderUpdateNoticeType" NOT NULL,
  "message" TEXT NOT NULL,
  "status" "CancellationNoticeStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt" TIMESTAMPTZ(3),
  "sentById" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderUpdateNotice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderUpdateNotice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderUpdateNotice_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrderUpdateNotice_orderId_type_key" ON "OrderUpdateNotice"("orderId", "type");
CREATE INDEX "OrderUpdateNotice_status_createdAt_idx" ON "OrderUpdateNotice"("status", "createdAt");
