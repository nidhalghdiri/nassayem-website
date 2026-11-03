-- Two new staff roles. Both start with the same permissions as MANAGER
-- (enforced in code via hasManagerAccess). Adding enum values does not
-- rewrite the table.

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'ACCOUNTANT';
ALTER TYPE "StaffRole" ADD VALUE 'ADMIN';
