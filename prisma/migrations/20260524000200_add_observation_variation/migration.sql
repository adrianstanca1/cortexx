-- Observation
CREATE TABLE "Observation" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "type"        TEXT NOT NULL DEFAULT 'positive',
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "location"    TEXT,
    "reportedBy"  TEXT,
    "photoUrl"    TEXT,
    "status"      TEXT NOT NULL DEFAULT 'open',
    "resolvedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Observation_projectId_status_idx" ON "Observation" ("projectId", "status");
CREATE INDEX "Observation_type_status_idx"      ON "Observation" ("type", "status");
CREATE INDEX "Observation_createdAt_idx"        ON "Observation" ("createdAt");
ALTER TABLE "Observation"
  ADD CONSTRAINT "Observation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Variation
CREATE TABLE "Variation" (
    "id"          TEXT NOT NULL,
    "number"      TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "costImpact"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysImpact"  INTEGER NOT NULL DEFAULT 0,
    "status"      TEXT NOT NULL DEFAULT 'draft',
    "clientName"  TEXT,
    "notes"       TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt"  TIMESTAMP(3),
    "rejectedAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Variation_projectId_number_key" ON "Variation" ("projectId", "number");
CREATE INDEX "Variation_projectId_status_idx"        ON "Variation" ("projectId", "status");
CREATE INDEX "Variation_status_idx"                  ON "Variation" ("status");
CREATE INDEX "Variation_submittedAt_idx"             ON "Variation" ("submittedAt");
ALTER TABLE "Variation"
  ADD CONSTRAINT "Variation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
