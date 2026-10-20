-- Monthly pricing per building + unit type, with an optional "شامل"
-- (utilities included) and "غير شامل" rate, and the guest's choice on Booking.
-- Additive only: safe to apply while the previous release is still live.
-- Unit."monthlyPrice" is no longer read by the app; it is dropped in a later
-- migration, once this release is deployed (the old release still selects it).

-- CreateEnum
CREATE TYPE "MonthlyOption" AS ENUM ('INCLUSIVE', 'EXCLUSIVE');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "monthlyOption" "MonthlyOption";

-- CreateTable
CREATE TABLE "MonthlyPrice" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "unitType" "UnitType" NOT NULL,
    "inclusivePrice" DECIMAL(10,3),
    "exclusivePrice" DECIMAL(10,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPrice_buildingId_unitType_key" ON "MonthlyPrice"("buildingId", "unitType");

-- AddForeignKey
ALTER TABLE "MonthlyPrice" ADD CONSTRAINT "MonthlyPrice_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
