-- Task: the size of a maintenance request (LARGE / MEDIUM / SMALL), chosen in the "New maintenance request" form.
-- Additive only: one nullable column; no data is changed or removed.

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "taskSize" TEXT;
