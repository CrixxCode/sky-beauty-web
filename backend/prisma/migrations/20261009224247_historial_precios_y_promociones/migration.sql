-- Historial de precios por variante, versiones de promociones y marca obligatoria.
-- Permiten editar un pedido con el precio y las promociones del día en que se hizo.
-- Ver Context/decisiones.md (2026-10-09).

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "brandId" SET NOT NULL;

-- CreateTable
CREATE TABLE "VariantPriceHistory" (
    "id" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "validFrom" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" UUID,

    CONSTRAINT "VariantPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRevision" (
    "id" UUID NOT NULL,
    "promotionId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "validFrom" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "scope" "PromotionScope" NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "variantIds" UUID[],
    "productIds" UUID[],
    "categoryIds" UUID[],
    "changedById" UUID,

    CONSTRAINT "PromotionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VariantPriceHistory_variantId_validFrom_idx" ON "VariantPriceHistory"("variantId", "validFrom");

-- CreateIndex
CREATE INDEX "PromotionRevision_promotionId_validFrom_idx" ON "PromotionRevision"("promotionId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRevision_promotionId_revision_key" ON "PromotionRevision"("promotionId", "revision");

-- AddForeignKey
ALTER TABLE "VariantPriceHistory" ADD CONSTRAINT "VariantPriceHistory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantPriceHistory" ADD CONSTRAINT "VariantPriceHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRevision" ADD CONSTRAINT "PromotionRevision_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRevision" ADD CONSTRAINT "PromotionRevision_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restricciones de integridad.

ALTER TABLE "VariantPriceHistory"
  ADD CONSTRAINT "VariantPriceHistory_price_non_negative" CHECK ("price" >= 0);

ALTER TABLE "PromotionRevision"
  ADD CONSTRAINT "PromotionRevision_revision_positive" CHECK ("revision" > 0),
  ADD CONSTRAINT "PromotionRevision_discount_value_positive" CHECK ("discountValue" > 0),
  ADD CONSTRAINT "PromotionRevision_percentage_max" CHECK ("discountType" <> 'PERCENTAGE' OR "discountValue" <= 100),
  ADD CONSTRAINT "PromotionRevision_dates_valid" CHECK ("endsAt" > "startsAt");
