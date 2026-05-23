-- AlterTable
ALTER TABLE "Document"
  ADD COLUMN "url"      TEXT,
  ADD COLUMN "size"     INTEGER,
  ADD COLUMN "mimeType" TEXT;
