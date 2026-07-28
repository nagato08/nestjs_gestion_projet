-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

-- AlterTable : decalage sur les dependances (0 = enchainement immediat)
ALTER TABLE "TaskDependency" ADD COLUMN "lagDays" INTEGER NOT NULL DEFAULT 0;

-- Une meme paire ne doit exister qu'une fois. Verifie sans doublon en prod
-- avant ecriture de cette migration.
CREATE UNIQUE INDEX "TaskDependency_blockingTaskId_blockedTaskId_key"
  ON "TaskDependency"("blockingTaskId", "blockedTaskId");

-- CreateTable : sprints
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "projectId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Sprint_projectId_idx" ON "Sprint"("projectId");
CREATE INDEX "Sprint_status_idx" ON "Sprint"("status");

ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable : jalons
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reached" BOOLEAN NOT NULL DEFAULT false,
    "reachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable : baseline et rattachement au sprint
ALTER TABLE "Task" ADD COLUMN "baselineStart" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "baselineEnd" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN "sprintId" TEXT;

-- SET NULL : supprimer un sprint ne supprime pas ses taches, elles
-- retournent au backlog.
ALTER TABLE "Task" ADD CONSTRAINT "Task_sprintId_fkey"
  FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
