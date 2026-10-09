/*
  Warnings:

  - Added the required column `dataProcessingConsentAt` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "dataProcessingConsentAt" TIMESTAMPTZ(3) NOT NULL;
