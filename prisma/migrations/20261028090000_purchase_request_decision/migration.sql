-- Website-side audit log of supervisor decisions on NetSuite purchase requests.
-- The request lives in NetSuite; this records who decided what on the website.
-- Also what makes the "Approved by me" tab cheap.
-- New table, so no lock contention with live writes.

-- CreateTable
CREATE TABLE "PurchaseRequestDecision" (
    "id" TEXT NOT NULL,
    "netsuiteRequestId" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "adminUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequestDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseRequestDecision_adminUserId_decision_idx" ON "PurchaseRequestDecision"("adminUserId", "decision");

-- CreateIndex
CREATE INDEX "PurchaseRequestDecision_netsuiteRequestId_idx" ON "PurchaseRequestDecision"("netsuiteRequestId");

-- CreateIndex
CREATE INDEX "PurchaseRequestDecision_createdAt_idx" ON "PurchaseRequestDecision"("createdAt");

-- AddForeignKey
ALTER TABLE "PurchaseRequestDecision" ADD CONSTRAINT "PurchaseRequestDecision_adminUserId_fkey"
  FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny-all RLS, matching WhatsAppMessageLog and prisma/sql/chatbot_rls.sql: a
-- public table without RLS is readable by the Supabase anon role via PostgREST,
-- and this one holds internal approval notes. No policies are created, so only
-- Prisma (which connects as the table owner) can reach it.
ALTER TABLE "PurchaseRequestDecision" ENABLE ROW LEVEL SECURITY;
