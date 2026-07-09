-- AlterTable
ALTER TABLE "ChatbotLead" ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "reservationNumber" TEXT;

-- CreateIndex
CREATE INDEX "ChatbotLead_reservationNumber_idx" ON "ChatbotLead"("reservationNumber");
