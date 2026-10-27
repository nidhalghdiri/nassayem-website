-- Manager approval of a LARGE task's size. Until approved, the scoring counts
-- the task as MEDIUM so an inflated estimate cannot lift a rating on its own.
ALTER TABLE "Task" ADD COLUMN "sizeApprovedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "sizeApprovedById" TEXT;

ALTER TABLE "Task" ADD CONSTRAINT "Task_sizeApprovedById_fkey"
  FOREIGN KEY ("sizeApprovedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Task_sizeApprovedAt_idx" ON "Task"("sizeApprovedAt");
