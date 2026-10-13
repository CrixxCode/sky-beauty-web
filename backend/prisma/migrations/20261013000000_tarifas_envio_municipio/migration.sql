ALTER TABLE "StoreSettings"
  ADD COLUMN "nationalFreeShipping" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MunicipalShippingRate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "municipalityCode" CHAR(5) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "MunicipalShippingRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MunicipalShippingRate_municipalityCode_key"
  ON "MunicipalShippingRate"("municipalityCode");

CREATE INDEX "MunicipalShippingRate_amount_idx"
  ON "MunicipalShippingRate"("amount");

ALTER TABLE "MunicipalShippingRate"
  ADD CONSTRAINT "MunicipalShippingRate_municipalityCode_fkey"
  FOREIGN KEY ("municipalityCode") REFERENCES "Municipality"("code")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MunicipalShippingRate"
  ADD CONSTRAINT "MunicipalShippingRate_amount_non_negative"
  CHECK ("amount" >= 0);

INSERT INTO "MunicipalShippingRate" ("municipalityCode", "amount", "updatedAt")
VALUES ('44001', 5000, CURRENT_TIMESTAMP)
ON CONFLICT ("municipalityCode") DO NOTHING;
