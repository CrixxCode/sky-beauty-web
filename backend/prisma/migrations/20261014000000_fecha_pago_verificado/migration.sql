-- Fecha en que el pago quedó verificado; los reportes ubican cada venta en ella.
ALTER TABLE "Order" ADD COLUMN "paidAt" TIMESTAMPTZ(3);

CREATE INDEX "Order_paidAt_idx" ON "Order"("paidAt");

-- Pedidos existentes: el primer registro de pago verificado de su historial.
UPDATE "Order" o
SET "paidAt" = p."paidAt"
FROM (
  SELECT "orderId", min("createdAt") AS "paidAt"
  FROM "PaymentRecord"
  WHERE "status" = 'PAID'
  GROUP BY "orderId"
) p
WHERE p."orderId" = o."id" AND o."paymentStatus" IN ('PAID', 'REFUNDED');
