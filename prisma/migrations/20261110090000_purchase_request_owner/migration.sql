-- Who raised a purchase request from the website. The request lives in NetSuite;
-- this lets a maintenance user see only their own requests and stops anyone
-- approving a request they created themselves.
-- New table, so no lock contention with live writes.

-- CreateTable
CREATE TABLE "PurchaseRequestOwner" (
    "id" TEXT NOT NULL,
    "netsuiteRequestId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequestOwner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequestOwner_netsuiteRequestId_key" ON "PurchaseRequestOwner"("netsuiteRequestId");

-- CreateIndex
CREATE INDEX "PurchaseRequestOwner_adminUserId_createdAt_idx" ON "PurchaseRequestOwner"("adminUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "PurchaseRequestOwner" ADD CONSTRAINT "PurchaseRequestOwner_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny-all RLS, matching PurchaseRequestDecision: no policies, so only Prisma
-- (which connects as the table owner) can reach it.
ALTER TABLE "PurchaseRequestOwner" ENABLE ROW LEVEL SECURITY;
