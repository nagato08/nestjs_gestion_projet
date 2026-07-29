-- CreateEnum
CREATE TYPE "ProjectMethodology" AS ENUM ('AGILE', 'CLASSIC');

-- CreateEnum
CREATE TYPE "ChargeUnit" AS ENUM ('HOURS', 'PERSON_DAYS');

-- CreateTable
CREATE TABLE "ProjectSettings" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "workingDays" INTEGER[] DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
    "publicHolidays" TIMESTAMP(3)[],
    "machineCapacityPerDay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lateAlertThresholdDays" INTEGER NOT NULL DEFAULT 2,
    "budgetAmount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "methodology" "ProjectMethodology" NOT NULL DEFAULT 'AGILE',
    "chargeUnit" "ChargeUnit" NOT NULL DEFAULT 'HOURS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSettings_projectId_key" ON "ProjectSettings"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectSettings" ADD CONSTRAINT "ProjectSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
