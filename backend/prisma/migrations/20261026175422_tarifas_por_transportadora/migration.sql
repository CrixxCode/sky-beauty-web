-- CreateTable
CREATE TABLE "CarrierShippingRate" (
    "id" UUID NOT NULL,
    "carrierId" UUID NOT NULL,
    "municipalityCode" CHAR(5) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CarrierShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CarrierShippingRate_municipalityCode_idx" ON "CarrierShippingRate"("municipalityCode");

-- CreateIndex
CREATE UNIQUE INDEX "CarrierShippingRate_carrierId_municipalityCode_key" ON "CarrierShippingRate"("carrierId", "municipalityCode");

-- AddForeignKey
ALTER TABLE "CarrierShippingRate" ADD CONSTRAINT "CarrierShippingRate_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierShippingRate" ADD CONSTRAINT "CarrierShippingRate_municipalityCode_fkey" FOREIGN KEY ("municipalityCode") REFERENCES "Municipality"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Una tarifa nunca es negativa (igual que MunicipalShippingRate).
ALTER TABLE "CarrierShippingRate"
  ADD CONSTRAINT "CarrierShippingRate_amount_non_negative"
  CHECK ("amount" >= 0);
