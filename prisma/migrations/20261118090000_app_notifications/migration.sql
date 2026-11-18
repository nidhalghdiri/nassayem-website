-- CreateTable
CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppNotification_adminUserId_createdAt_idx" ON "AppNotification"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AppNotification_adminUserId_readAt_idx" ON "AppNotification"("adminUserId", "readAt");

-- AddForeignKey
ALTER TABLE "AppNotification" ADD CONSTRAINT "AppNotification_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
