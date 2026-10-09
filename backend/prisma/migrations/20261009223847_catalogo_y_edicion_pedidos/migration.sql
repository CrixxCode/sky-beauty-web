-- Catálogo (marcas, subcategorías, fotos por variante, contenido neto, costo y límite por pedido),
-- promociones por variante y edición de pedidos sin confirmar.
-- Ver Context/decisiones.md (2026-10-09).

-- AlterEnum
ALTER TYPE "OrderEventType" ADD VALUE 'ITEMS_CHANGED';

-- AlterEnum
ALTER TYPE "PromotionScope" ADD VALUE 'VARIANT';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "parentId" UUID;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "unitCost" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "brand",
ADD COLUMN     "brandId" UUID,
ADD COLUMN     "netContent" VARCHAR(50);

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "variantId" UUID;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "costPrice" DECIMAL(12,2),
ADD COLUMN     "maxPerOrder" INTEGER;

-- CreateTable
CREATE TABLE "Brand" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionVariant" (
    "promotionId" UUID NOT NULL,
    "variantId" UUID NOT NULL,

    CONSTRAINT "PromotionVariant_pkey" PRIMARY KEY ("promotionId","variantId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_isActive_name_idx" ON "Brand"("isActive", "name");

-- CreateIndex
CREATE INDEX "PromotionVariant_variantId_idx" ON "PromotionVariant"("variantId");

-- CreateIndex
CREATE INDEX "Category_parentId_position_idx" ON "Category"("parentId", "position");

-- CreateIndex
CREATE INDEX "Product_status_brandId_idx" ON "Product"("status", "brandId");

-- CreateIndex
CREATE INDEX "ProductImage_variantId_position_idx" ON "ProductImage"("variantId", "position");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionVariant" ADD CONSTRAINT "PromotionVariant_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionVariant" ADD CONSTRAINT "PromotionVariant_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restricciones de integridad.

ALTER TABLE "Category"
  ADD CONSTRAINT "Category_not_own_parent" CHECK ("parentId" IS NULL OR "parentId" <> "id");

ALTER TABLE "ProductVariant"
  ADD CONSTRAINT "ProductVariant_cost_price_non_negative" CHECK ("costPrice" IS NULL OR "costPrice" >= 0),
  ADD CONSTRAINT "ProductVariant_max_per_order_positive" CHECK ("maxPerOrder" IS NULL OR "maxPerOrder" > 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_unit_cost_non_negative" CHECK ("unitCost" IS NULL OR "unitCost" >= 0);
