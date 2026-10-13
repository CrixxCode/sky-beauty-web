-- CreateEnum
CREATE TYPE "ShippingMethod" AS ENUM ('CARRIER', 'LOCAL');

-- AlterTable: alinea con el esquema (el id lo genera Prisma, no la base de datos).
ALTER TABLE "MunicipalShippingRate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable: tipo de entrega del envío (decisión del 2026-10-13). Los envíos existentes son por transportadora.
ALTER TABLE "Shipping" ADD COLUMN     "method" "ShippingMethod" NOT NULL DEFAULT 'CARRIER';
