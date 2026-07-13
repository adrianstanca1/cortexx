-- AlterTable
ALTER TABLE "Document"
  ADD COLUMN "tags"    JSONB   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
