-- CreateEnum
CREATE TYPE "CancellationNoticeCase" AS ENUM ('UNCONFIRMED', 'NO_PAYMENT_PROOF', 'PAYMENT_NOT_PROVEN');

-- CreateEnum
CREATE TYPE "CancellationNoticeStage" AS ENUM ('BEFORE', 'AFTER');

-- CreateEnum
CREATE TYPE "CancellationNoticeStatus" AS ENUM ('PENDING', 'SENT', 'EXPIRED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "AdminNotificationType" AS ENUM ('NOTICE_PENDING', 'ORDER_AUTO_CANCELLED');

-- CreateTable
CREATE TABLE "CancellationNotice" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "case" "CancellationNoticeCase" NOT NULL,
    "stage" "CancellationNoticeStage" NOT NULL,
    "deadlineAt" TIMESTAMPTZ(3) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "CancellationNoticeStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMPTZ(3),
    "sentById" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CancellationNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" UUID NOT NULL,
    "type" "AdminNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "orderId" UUID,
    "noticeId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotificationRead" (
    "notificationId" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "readAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotificationRead_pkey" PRIMARY KEY ("notificationId","adminId")
);

-- CreateIndex
CREATE INDEX "CancellationNotice_status_createdAt_idx" ON "CancellationNotice"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationNotice_orderId_case_stage_deadlineAt_key" ON "CancellationNotice"("orderId", "case", "stage", "deadlineAt");

-- CreateIndex
CREATE INDEX "AdminNotification_createdAt_idx" ON "AdminNotification"("createdAt");

-- CreateIndex
CREATE INDEX "AdminNotificationRead_adminId_idx" ON "AdminNotificationRead"("adminId");

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationNotice" ADD CONSTRAINT "CancellationNotice_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "CancellationNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotificationRead" ADD CONSTRAINT "AdminNotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "AdminNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotificationRead" ADD CONSTRAINT "AdminNotificationRead_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
