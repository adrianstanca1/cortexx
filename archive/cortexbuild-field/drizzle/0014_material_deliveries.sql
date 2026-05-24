CREATE TABLE IF NOT EXISTS "material_deliveries" (
  "id"                    SERIAL PRIMARY KEY,
  "companyId"             INTEGER NOT NULL REFERENCES "companies"("id"),
  "projectId"             INTEGER NOT NULL REFERENCES "projects"("id"),
  "supplierName"          VARCHAR(255) NOT NULL,
  "materialDescription"   TEXT NOT NULL,
  "expectedAt"            TIMESTAMP NOT NULL,
  "deliveredAt"           TIMESTAMP,
  "status"                VARCHAR(20) NOT NULL DEFAULT 'expected',
  "rejectionReason"       TEXT,
  "cancellationReason"    TEXT,
  "notes"                 TEXT,
  "gpsLat"                NUMERIC(9,6),
  "gpsLng"                NUMERIC(9,6),
  "photoStorageKeys"      TEXT[] NOT NULL DEFAULT '{}',
  "createdById"           INTEGER NOT NULL REFERENCES "users"("id"),
  "receivedById"          INTEGER REFERENCES "users"("id"),
  "createdAt"             TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "material_deliveries_agenda_idx"
  ON "material_deliveries" ("companyId", "projectId", "expectedAt");

CREATE INDEX IF NOT EXISTS "material_deliveries_status_idx"
  ON "material_deliveries" ("companyId", "status");

CREATE INDEX IF NOT EXISTS "material_deliveries_delivered_idx"
  ON "material_deliveries" ("companyId", "deliveredAt")
  WHERE "deliveredAt" IS NOT NULL;
