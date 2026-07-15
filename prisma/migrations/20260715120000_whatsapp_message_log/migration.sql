-- Outbound WhatsApp audit log — one row per send, written from lib/whatsapp.ts.
-- New table, so no lock contention with live writes.

-- CreateTable
CREATE TABLE "WhatsAppMessageLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "templateName" TEXT,
    "language" TEXT,
    "bodyParams" JSONB,
    "body" TEXT,
    "mediaUrl" TEXT,
    "waMessageId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_createdAt_idx" ON "WhatsAppMessageLog"("createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_to_createdAt_idx" ON "WhatsAppMessageLog"("to", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessageLog_status_createdAt_idx" ON "WhatsAppMessageLog"("status", "createdAt");

-- Deny-all RLS, matching prisma/sql/chatbot_rls.sql: this table holds customer
-- phone numbers and escalation detail, and a public table without RLS is
-- readable by the Supabase anon role via PostgREST. No policies are created, so
-- only Prisma (which connects as the table owner) can reach it. Enabled here
-- rather than in prisma/sql so it can never ship a deploy behind the table.
ALTER TABLE "WhatsAppMessageLog" ENABLE ROW LEVEL SECURITY;
