-- SiteCheckIn
CREATE TABLE "SiteCheckIn" (
    "id"           TEXT NOT NULL,
    "memberId"     TEXT NOT NULL,
    "projectId"    TEXT NOT NULL,
    "checkedInAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedOutAt" TIMESTAMP(3),
    "latitudeIn"   DOUBLE PRECISION,
    "longitudeIn"  DOUBLE PRECISION,
    "latitudeOut"  DOUBLE PRECISION,
    "longitudeOut" DOUBLE PRECISION,
    "notes"        TEXT,
    CONSTRAINT "SiteCheckIn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SiteCheckIn_memberId_checkedInAt_idx"  ON "SiteCheckIn" ("memberId", "checkedInAt");
CREATE INDEX "SiteCheckIn_projectId_checkedInAt_idx" ON "SiteCheckIn" ("projectId", "checkedInAt");
CREATE INDEX "SiteCheckIn_checkedOutAt_idx"          ON "SiteCheckIn" ("checkedOutAt");
ALTER TABLE "SiteCheckIn"
  ADD CONSTRAINT "SiteCheckIn_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteCheckIn"
  ADD CONSTRAINT "SiteCheckIn_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- MileageEntry
CREATE TABLE "MileageEntry" (
    "id"           TEXT NOT NULL,
    "memberId"     TEXT,
    "date"         TIMESTAMP(3) NOT NULL,
    "fromAddress"  TEXT NOT NULL,
    "toAddress"    TEXT NOT NULL,
    "fromPostcode" TEXT,
    "toPostcode"   TEXT,
    "miles"        DOUBLE PRECISION NOT NULL,
    "vehicleType"  TEXT NOT NULL DEFAULT 'car',
    "purpose"      TEXT,
    "ratePence"    DOUBLE PRECISION NOT NULL DEFAULT 45,
    "amount"       DOUBLE PRECISION NOT NULL,
    "approved"     BOOLEAN NOT NULL DEFAULT false,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MileageEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MileageEntry_memberId_date_idx" ON "MileageEntry" ("memberId", "date");
CREATE INDEX "MileageEntry_date_idx"          ON "MileageEntry" ("date");
CREATE INDEX "MileageEntry_approved_idx"      ON "MileageEntry" ("approved");
ALTER TABLE "MileageEntry"
  ADD CONSTRAINT "MileageEntry_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "TeamMember" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
