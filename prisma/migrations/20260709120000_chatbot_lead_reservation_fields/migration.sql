-- Give the ALTER room to acquire its lock behind live writes to ChatbotLead
-- (the default Supabase statement_timeout cancelled this migration once).
SET statement_timeout = '120s';

-- AlterTable
ALTER TABLE "ChatbotLead" ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "reservationNumber" TEXT;
