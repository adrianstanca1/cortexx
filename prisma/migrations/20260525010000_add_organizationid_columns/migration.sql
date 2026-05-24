-- Add organizationId column to every owned table.
-- Nullable for now — existing rows get backfilled to the default workspace,
-- and a follow-up migration will tighten to NOT NULL once production data
-- is verified.

-- Ensure the default workspace exists. Idempotent via the unique slug
-- constraint — re-running just re-uses the existing row.
INSERT INTO "Organization" (id, slug, name, plan, "subscriptionStatus", "createdAt", "updatedAt")
SELECT 'org_bootstrap_cortexx', 'cortexbuildpro', 'Cortexbuild Pro', 'pro', 'active', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Organization" WHERE slug = 'cortexbuildpro');

-- Look up the bootstrap org id (whatever it is, whether we just inserted
-- or it already existed) so we can backfill consistently.
DO $$
DECLARE
  default_org_id TEXT;
BEGIN
  SELECT id INTO default_org_id FROM "Organization" WHERE slug = 'cortexbuildpro' LIMIT 1;
  IF default_org_id IS NULL THEN
    RAISE EXCEPTION 'No default organization found and INSERT did not create one';
  END IF;

  -- Each table: ADD COLUMN (nullable), UPDATE existing rows, then add FK + index.
  -- Order doesn't matter because the FK target ("Organization") already exists.

  PERFORM 1; -- keep DO block tidy

  -- Project
  ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Project" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Task
  ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Task" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Task" ADD CONSTRAINT "Task_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- TeamMember
  ALTER TABLE "TeamMember" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "TeamMember" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Assignment
  ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Assignment" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Invoice
  ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Invoice" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- TimeEntry
  ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "TimeEntry" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Activity
  ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Activity" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Activity" ADD CONSTRAINT "Activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Comment
  ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Comment" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Comment" ADD CONSTRAINT "Comment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Document
  ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Document" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Snag
  ALTER TABLE "Snag" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Snag" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Snag" ADD CONSTRAINT "Snag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Certification
  ALTER TABLE "Certification" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Certification" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Certification" ADD CONSTRAINT "Certification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Rfi
  ALTER TABLE "Rfi" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Rfi" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Announcement
  ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Announcement" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Observation
  ALTER TABLE "Observation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Observation" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Observation" ADD CONSTRAINT "Observation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Variation
  ALTER TABLE "Variation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Variation" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Variation" ADD CONSTRAINT "Variation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Lead
  ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Lead" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Customer
  ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Customer" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Quote
  ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Quote" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Quote" ADD CONSTRAINT "Quote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- SiteCheckIn
  ALTER TABLE "SiteCheckIn" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "SiteCheckIn" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "SiteCheckIn" ADD CONSTRAINT "SiteCheckIn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- MileageEntry
  ALTER TABLE "MileageEntry" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "MileageEntry" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "MileageEntry" ADD CONSTRAINT "MileageEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- CostItem
  ALTER TABLE "CostItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "CostItem" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Subcontractor
  ALTER TABLE "Subcontractor" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Subcontractor" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Subcontractor" ADD CONSTRAINT "Subcontractor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Equipment
  ALTER TABLE "Equipment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Equipment" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Material
  ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Material" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Material" ADD CONSTRAINT "Material_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- PurchaseOrder
  ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "PurchaseOrder" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- SubInvoice
  ALTER TABLE "SubInvoice" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "SubInvoice" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "SubInvoice" ADD CONSTRAINT "SubInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Drawing
  ALTER TABLE "Drawing" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Drawing" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Drawing" ADD CONSTRAINT "Drawing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- DrawingRevision
  ALTER TABLE "DrawingRevision" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "DrawingRevision" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "DrawingRevision" ADD CONSTRAINT "DrawingRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Milestone
  ALTER TABLE "Milestone" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Milestone" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Permit
  ALTER TABLE "Permit" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Permit" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Permit" ADD CONSTRAINT "Permit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Rams
  ALTER TABLE "Rams" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Rams" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Rams" ADD CONSTRAINT "Rams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Tender
  ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Tender" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Tender" ADD CONSTRAINT "Tender_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Inspection
  ALTER TABLE "Inspection" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Inspection" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Meeting
  ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Meeting" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Risk
  ALTER TABLE "Risk" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Risk" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Risk" ADD CONSTRAINT "Risk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- ToolboxTalk
  ALTER TABLE "ToolboxTalk" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "ToolboxTalk" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "ToolboxTalk" ADD CONSTRAINT "ToolboxTalk_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- MaintenanceSchedule
  ALTER TABLE "MaintenanceSchedule" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "MaintenanceSchedule" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- Supplier
  ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "Supplier" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;

  -- SafetyIncident
  ALTER TABLE "SafetyIncident" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
  UPDATE "SafetyIncident" SET "organizationId" = default_org_id WHERE "organizationId" IS NULL;
  ALTER TABLE "SafetyIncident" ADD CONSTRAINT "SafetyIncident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE;
END $$;

-- Indexes: created outside the DO block so they run as standalone statements.
CREATE INDEX IF NOT EXISTS "Project_organizationId_idx" ON "Project"("organizationId");
CREATE INDEX IF NOT EXISTS "Task_organizationId_idx" ON "Task"("organizationId");
CREATE INDEX IF NOT EXISTS "TeamMember_organizationId_idx" ON "TeamMember"("organizationId");
CREATE INDEX IF NOT EXISTS "Assignment_organizationId_idx" ON "Assignment"("organizationId");
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_idx" ON "Invoice"("organizationId");
CREATE INDEX IF NOT EXISTS "TimeEntry_organizationId_idx" ON "TimeEntry"("organizationId");
CREATE INDEX IF NOT EXISTS "Activity_organizationId_idx" ON "Activity"("organizationId");
CREATE INDEX IF NOT EXISTS "Comment_organizationId_idx" ON "Comment"("organizationId");
CREATE INDEX IF NOT EXISTS "Document_organizationId_idx" ON "Document"("organizationId");
CREATE INDEX IF NOT EXISTS "Snag_organizationId_idx" ON "Snag"("organizationId");
CREATE INDEX IF NOT EXISTS "Certification_organizationId_idx" ON "Certification"("organizationId");
CREATE INDEX IF NOT EXISTS "Rfi_organizationId_idx" ON "Rfi"("organizationId");
CREATE INDEX IF NOT EXISTS "Announcement_organizationId_idx" ON "Announcement"("organizationId");
CREATE INDEX IF NOT EXISTS "Observation_organizationId_idx" ON "Observation"("organizationId");
CREATE INDEX IF NOT EXISTS "Variation_organizationId_idx" ON "Variation"("organizationId");
CREATE INDEX IF NOT EXISTS "Lead_organizationId_idx" ON "Lead"("organizationId");
CREATE INDEX IF NOT EXISTS "Customer_organizationId_idx" ON "Customer"("organizationId");
CREATE INDEX IF NOT EXISTS "Quote_organizationId_idx" ON "Quote"("organizationId");
CREATE INDEX IF NOT EXISTS "SiteCheckIn_organizationId_idx" ON "SiteCheckIn"("organizationId");
CREATE INDEX IF NOT EXISTS "MileageEntry_organizationId_idx" ON "MileageEntry"("organizationId");
CREATE INDEX IF NOT EXISTS "CostItem_organizationId_idx" ON "CostItem"("organizationId");
CREATE INDEX IF NOT EXISTS "Subcontractor_organizationId_idx" ON "Subcontractor"("organizationId");
CREATE INDEX IF NOT EXISTS "Equipment_organizationId_idx" ON "Equipment"("organizationId");
CREATE INDEX IF NOT EXISTS "Material_organizationId_idx" ON "Material"("organizationId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_organizationId_idx" ON "PurchaseOrder"("organizationId");
CREATE INDEX IF NOT EXISTS "SubInvoice_organizationId_idx" ON "SubInvoice"("organizationId");
CREATE INDEX IF NOT EXISTS "Drawing_organizationId_idx" ON "Drawing"("organizationId");
CREATE INDEX IF NOT EXISTS "DrawingRevision_organizationId_idx" ON "DrawingRevision"("organizationId");
CREATE INDEX IF NOT EXISTS "Milestone_organizationId_idx" ON "Milestone"("organizationId");
CREATE INDEX IF NOT EXISTS "Permit_organizationId_idx" ON "Permit"("organizationId");
CREATE INDEX IF NOT EXISTS "Rams_organizationId_idx" ON "Rams"("organizationId");
CREATE INDEX IF NOT EXISTS "Tender_organizationId_idx" ON "Tender"("organizationId");
CREATE INDEX IF NOT EXISTS "Inspection_organizationId_idx" ON "Inspection"("organizationId");
CREATE INDEX IF NOT EXISTS "Meeting_organizationId_idx" ON "Meeting"("organizationId");
CREATE INDEX IF NOT EXISTS "Risk_organizationId_idx" ON "Risk"("organizationId");
CREATE INDEX IF NOT EXISTS "ToolboxTalk_organizationId_idx" ON "ToolboxTalk"("organizationId");
CREATE INDEX IF NOT EXISTS "MaintenanceSchedule_organizationId_idx" ON "MaintenanceSchedule"("organizationId");
CREATE INDEX IF NOT EXISTS "Supplier_organizationId_idx" ON "Supplier"("organizationId");
CREATE INDEX IF NOT EXISTS "SafetyIncident_organizationId_idx" ON "SafetyIncident"("organizationId");
