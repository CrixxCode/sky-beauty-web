-- Decisiones de negocio confirmadas el 2026-10-09 (ver Context/decisiones.md).
-- Se retiran primero las restricciones que dependen de columnas que cambian.

ALTER TABLE "Promotion" DROP CONSTRAINT "Promotion_percentage_max";
ALTER TABLE "Order" DROP CONSTRAINT "Order_amounts_non_negative";
ALTER TABLE "Order" DROP CONSTRAINT "Order_total_consistent";
ALTER TABLE "StoreSettings" DROP CONSTRAINT "StoreSettings_shipping_non_negative";

/*
  Warnings:

  - You are about to drop the column `shippingFlatRate` on the `StoreSettings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "shippingCost" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PaymentMethod" ADD COLUMN     "maxOrderTotal" DECIMAL(12,2),
ADD COLUMN     "restrictToCities" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "lowStockThreshold" DROP NOT NULL,
ALTER COLUMN "lowStockThreshold" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StoreSettings" DROP COLUMN "shippingFlatRate",
ADD COLUMN     "defaultLowStockThreshold" INTEGER,
ADD COLUMN     "maxPercentageDiscount" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "PaymentMethodCity" (
    "id" UUID NOT NULL,
    "paymentMethodId" UUID NOT NULL,
    "department" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethodCity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodCity_paymentMethodId_department_city_key" ON "PaymentMethodCity"("paymentMethodId", "department", "city");

-- AddForeignKey
ALTER TABLE "PaymentMethodCity" ADD CONSTRAINT "PaymentMethodCity_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restricciones de integridad actualizadas.

-- El límite comercial del descuento porcentual vive en StoreSettings.maxPercentageDiscount
-- (lo valida la aplicación); la base de datos solo impide superar el 100 %.
ALTER TABLE "Promotion"
  ADD CONSTRAINT "Promotion_percentage_max" CHECK ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100);

-- shippingCost null = envío por confirmar; el total no lo incluye hasta que se cotice.
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_amounts_non_negative" CHECK (
    "subtotal" >= 0 AND "discountTotal" >= 0 AND ("shippingCost" IS NULL OR "shippingCost" >= 0) AND "total" >= 0
  ),
  ADD CONSTRAINT "Order_total_consistent" CHECK (
    "total" = "subtotal" - "discountTotal" + COALESCE("shippingCost", 0)
  );

ALTER TABLE "PaymentMethod"
  ADD CONSTRAINT "PaymentMethod_max_order_total_non_negative" CHECK ("maxOrderTotal" IS NULL OR "maxOrderTotal" >= 0);

ALTER TABLE "StoreSettings"
  ADD CONSTRAINT "StoreSettings_shipping_non_negative" CHECK (
    "freeShippingThreshold" IS NULL OR "freeShippingThreshold" >= 0
  ),
  ADD CONSTRAINT "StoreSettings_default_low_stock_non_negative" CHECK (
    "defaultLowStockThreshold" IS NULL OR "defaultLowStockThreshold" >= 0
  ),
  ADD CONSTRAINT "StoreSettings_max_percentage_discount_range" CHECK (
    "maxPercentageDiscount" IS NULL OR ("maxPercentageDiscount" > 0 AND "maxPercentageDiscount" <= 100)
  );
