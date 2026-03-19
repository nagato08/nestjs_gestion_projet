-- Chat par projet : Conversation 1-1 avec Project, plus de relation User[].

-- Supprimer les messages et conversations existants (ancien modèle)
DELETE FROM "ChatMessage";
DELETE FROM "Conversation";

-- Supprimer la table de jointure Conversation <-> User
DROP TABLE IF EXISTS "_ConversationToUser";

-- Ajouter la colonne projectId (temporairement nullable)
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- Créer une conversation par projet existant
INSERT INTO "Conversation" ("id", "projectId", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."id", NOW(), NOW()
FROM "Project" p
WHERE p."deletedAt" IS NULL;

-- Contrainte unique et clé étrangère
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_projectId_key" ON "Conversation"("projectId");
ALTER TABLE "Conversation" DROP CONSTRAINT IF EXISTS "Conversation_projectId_fkey";
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rendre projectId obligatoire
ALTER TABLE "Conversation" ALTER COLUMN "projectId" SET NOT NULL;
