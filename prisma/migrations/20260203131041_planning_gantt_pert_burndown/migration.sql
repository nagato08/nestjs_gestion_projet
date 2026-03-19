-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "optimisticDays" INTEGER,
ADD COLUMN     "pessimisticDays" INTEGER,
ADD COLUMN     "probableDays" INTEGER,
ADD COLUMN     "startDate" TIMESTAMP(3),
ADD COLUMN     "storyPoints" INTEGER;
