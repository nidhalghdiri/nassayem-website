-- Task: maintenance-request category + room, and a sequential request number.
-- Additive only: two nullable columns and one auto-numbered column; no data is changed or removed.

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "category" TEXT;
ALTER TABLE "Task" ADD COLUMN "room" TEXT;
ALTER TABLE "Task" ADD COLUMN "requestNumber" SERIAL;

-- Number the existing tasks 1..N in creation order (the new column is first filled in arbitrary order)
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn FROM "Task"
)
UPDATE "Task" SET "requestNumber" = ordered.rn FROM ordered WHERE "Task"."id" = ordered."id";

-- New tasks continue after the highest existing number
SELECT setval(pg_get_serial_sequence('"Task"', 'requestNumber'), COALESCE((SELECT MAX("requestNumber") FROM "Task"), 0) + 1, false);

-- CreateIndex
CREATE UNIQUE INDEX "Task_requestNumber_key" ON "Task"("requestNumber");

-- CreateIndex
CREATE INDEX "Task_category_idx" ON "Task"("category");
