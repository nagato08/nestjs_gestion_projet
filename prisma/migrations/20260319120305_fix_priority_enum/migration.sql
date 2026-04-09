/*
  Warnings:

  - Changed the type of `priority` on the `Project` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `priority` on the `Task` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "priority",
ADD COLUMN     "priority" "Priority" NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "priority",
ADD COLUMN     "priority" "Priority" NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetPasswordTokenExpiresAt" TIMESTAMP(3);
