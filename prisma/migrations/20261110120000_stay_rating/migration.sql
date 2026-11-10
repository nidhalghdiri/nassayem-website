-- Post-checkout stay ratings: one row per NetSuite reservation. New enums and
-- table only, so no lock contention with live writes.

-- CreateEnum
CREATE TYPE "StayRatingStatus" AS ENUM ('SENT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "StayRatingSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "StayRating" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "netsuiteReservationId" TEXT NOT NULL,
    "reservationNumber" TEXT,
    "customerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "building" TEXT,
    "unitNumbers" TEXT,
    "checkoutDate" TIMESTAMP(3),
    "language" TEXT NOT NULL DEFAULT 'ar',
    "waSendStatus" TEXT,
    "status" "StayRatingStatus" NOT NULL DEFAULT 'SENT',
    "cleanliness" INTEGER,
    "reception" INTEGER,
    "facilities" INTEGER,
    "value" INTEGER,
    "wouldRecommend" BOOLEAN,
    "comment" TEXT,
    "submittedAt" TIMESTAMP(3),
    "nsSyncStatus" "StayRatingSyncStatus",
    "nsSyncError" TEXT,
    "nsSyncedAt" TIMESTAMP(3),
    "nsSyncAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StayRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StayRating_token_key" ON "StayRating"("token");

-- CreateIndex
CREATE UNIQUE INDEX "StayRating_netsuiteReservationId_key" ON "StayRating"("netsuiteReservationId");

-- CreateIndex
CREATE INDEX "StayRating_status_createdAt_idx" ON "StayRating"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StayRating_nsSyncStatus_idx" ON "StayRating"("nsSyncStatus");

-- Deny-all RLS, matching the other server-only tables: no policies, so only
-- Prisma (which connects as the table owner) can reach it.
ALTER TABLE "StayRating" ENABLE ROW LEVEL SECURITY;
