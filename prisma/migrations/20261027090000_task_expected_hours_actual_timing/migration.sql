-- Expected duration entered on task creation; taskSize is classified from it.
ALTER TABLE "Task" ADD COLUMN "expectedHours" DOUBLE PRECISION;

-- Actual timing, stamped on first start / completion so durations can be
-- queried and exported directly instead of replaying the activity log.
ALTER TABLE "Task" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "actualHours" DOUBLE PRECISION;
