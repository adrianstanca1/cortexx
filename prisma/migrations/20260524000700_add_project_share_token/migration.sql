ALTER TABLE "Project" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "Project_shareToken_key" ON "Project" ("shareToken");
