-- Task: whether a guest is staying in the unit, asked by the "New maintenance request" form.
-- Additive only: one nullable column; no data is changed or removed.

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "guestInUnit" BOOLEAN;
