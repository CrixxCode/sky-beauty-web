-- Departamentos y municipios oficiales (DIVIPOLA del DANE) y motivo obligatorio al cancelar.
-- Ver Context/decisiones.md (2026-10-09).

-- DropIndex
DROP INDEX "PaymentMethodCity_paymentMethodId_department_city_key";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "municipalityCode" CHAR(5) NOT NULL;

-- AlterTable
ALTER TABLE "PaymentMethodCity" DROP COLUMN "city",
DROP COLUMN "department",
ADD COLUMN     "municipalityCode" CHAR(5) NOT NULL;

-- CreateTable
CREATE TABLE "Department" (
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Municipality" (
    "code" CHAR(5) NOT NULL,
    "departmentCode" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Municipality_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "Municipality_departmentCode_name_idx" ON "Municipality"("departmentCode", "name");

-- CreateIndex
CREATE INDEX "PaymentMethodCity_municipalityCode_idx" ON "PaymentMethodCity"("municipalityCode");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodCity_paymentMethodId_municipalityCode_key" ON "PaymentMethodCity"("paymentMethodId", "municipalityCode");

-- AddForeignKey
ALTER TABLE "PaymentMethodCity" ADD CONSTRAINT "PaymentMethodCity_municipalityCode_fkey" FOREIGN KEY ("municipalityCode") REFERENCES "Municipality"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_municipalityCode_fkey" FOREIGN KEY ("municipalityCode") REFERENCES "Municipality"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Municipality" ADD CONSTRAINT "Municipality_departmentCode_fkey" FOREIGN KEY ("departmentCode") REFERENCES "Department"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones de integridad.

ALTER TABLE "Department"
  ADD CONSTRAINT "Department_code_format" CHECK ("code" ~ '^[0-9]{2}$');

ALTER TABLE "Municipality"
  ADD CONSTRAINT "Municipality_code_format" CHECK ("code" ~ '^[0-9]{5}$'),
  ADD CONSTRAINT "Municipality_code_matches_department" CHECK (left("code", 2) = "departmentCode");

-- Todo pedido cancelado (manual o automáticamente) debe indicar el motivo.
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_cancel_reason_required" CHECK (
    "status" <> 'CANCELLED' OR ("cancelReason" IS NOT NULL AND btrim("cancelReason") <> '')
  );
