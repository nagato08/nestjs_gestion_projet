-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER';

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- Backfill : le propriétaire du projet devient OWNER dans la table des membres.
-- Les membres existants restent MEMBER (valeur par défaut), ce qui préserve
-- exactement les permissions dont ils disposaient avant cette migration.
UPDATE "ProjectMember" AS pm
SET "role" = 'OWNER'
FROM "Project" AS p
WHERE pm."projectId" = p."id"
  AND pm."userId" = p."ownerId";
