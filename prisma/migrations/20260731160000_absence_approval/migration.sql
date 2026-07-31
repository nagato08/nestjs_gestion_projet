-- CreateEnum
CREATE TYPE "AbsenceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Absence" ADD COLUMN     "status" "AbsenceStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approverId" TEXT,
ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decisionNote" TEXT;

-- CreateIndex
CREATE INDEX "Absence_status_idx" ON "Absence"("status");

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
