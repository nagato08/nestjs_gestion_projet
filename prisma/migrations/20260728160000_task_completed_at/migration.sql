-- Date de complétion figée, distincte de updatedAt.
ALTER TABLE "Task" ADD COLUMN "completedAt" TIMESTAMP(3);

-- Reprise de l'existant : pour les tâches déjà terminées, updatedAt est la
-- seule approximation disponible de leur date de complétion. Elle est
-- imparfaite — toute modification postérieure au passage en DONE l'a
-- décalée — mais c'est la meilleure information dont on dispose, et elle
-- cesse de dériver à partir de maintenant.
UPDATE "Task" SET "completedAt" = "updatedAt" WHERE "status" = 'DONE';

-- Le burndown balaie les tâches d'un projet par date de complétion.
CREATE INDEX "Task_completedAt_idx" ON "Task"("completedAt");
