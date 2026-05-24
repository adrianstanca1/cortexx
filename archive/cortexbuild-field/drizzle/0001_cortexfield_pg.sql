-- CortexBuild Field — Full PostgreSQL Schema Migration
-- Run this against the cortexbuild_field database on VPS

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('not_started', 'in_progress', 'completed', 'blocked', 'on_hold');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE team_member_status AS ENUM ('active', 'inactive', 'on_leave');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE timesheet_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE incident_type AS ENUM ('near_miss', 'first_aid', 'accident', 'dangerous_occurrence', 'environmental', 'security');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE incident_severity AS ENUM ('near_miss', 'low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM ('open', 'under_investigation', 'action_required', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE defect_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE defect_status AS ENUM ('open', 'in_progress', 'resolved', 'closed', 'disputed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE permit_type AS ENUM ('hot_work', 'confined_space', 'excavation', 'working_at_height', 'electrical', 'general');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE permit_status AS ENUM ('draft', 'pending', 'active', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE permit_risk_level AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE daily_report_status AS ENUM ('draft', 'submitted', 'approved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE file_category AS ENUM ('photo', 'certificate', 'payslip', 'drawing', 'report', 'document', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE document_type AS ENUM ('rams', 'toolbox_talk', 'daily_report', 'invoice', 'timesheet', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM ('draft', 'final', 'sent');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE platform AS ENUM ('ios', 'android', 'web');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE pin_type AS ENUM ('defect', 'rfi', 'note');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE pin_status AS ENUM ('open', 'in_progress', 'resolved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  "openId"      VARCHAR(64)  NOT NULL UNIQUE,
  name          TEXT,
  email         VARCHAR(320),
  "loginMethod" VARCHAR(64),
  role          user_role    NOT NULL DEFAULT 'user',
  "createdAt"   TIMESTAMP    NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP    NOT NULL DEFAULT NOW(),
  "lastSignedIn" TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  "clientName"     VARCHAR(255),
  status           project_status NOT NULL DEFAULT 'planning',
  "startDate"      TIMESTAMP,
  "endDate"        TIMESTAMP,
  budget           DECIMAL(12,2),
  spent            DECIMAL(12,2) DEFAULT 0,
  progress         INTEGER DEFAULT 0,
  "siteAddress"    TEXT,
  "siteLat"        DECIMAL(10,7),
  "siteLng"        DECIMAL(10,7),
  "geofenceRadius" INTEGER DEFAULT 200,
  "projectManager" VARCHAR(255),
  "contractType"   VARCHAR(100),
  "createdBy"      INTEGER,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TASKS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  "projectId"  INTEGER NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  status       task_status NOT NULL DEFAULT 'not_started',
  priority     task_priority NOT NULL DEFAULT 'medium',
  "assignedTo" VARCHAR(255),
  "dueDate"    TIMESTAMP,
  "completedAt" TIMESTAMP,
  progress     INTEGER DEFAULT 0,
  trade        VARCHAR(100),
  "createdBy"  INTEGER,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TEAM MEMBERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(100) NOT NULL,
  trade         VARCHAR(100),
  email         VARCHAR(320),
  phone         VARCHAR(30),
  "cscsCardType" VARCHAR(100),
  "cscsExpiry"  TIMESTAMP,
  status        team_member_status NOT NULL DEFAULT 'active',
  "projectId"   INTEGER,
  "hourlyRate"  DECIMAL(8,2),
  "avatarUrl"   TEXT,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK-INS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS check_ins (
  id                 SERIAL PRIMARY KEY,
  "userId"           INTEGER,
  "workerName"       VARCHAR(255),
  "projectId"        INTEGER NOT NULL,
  "checkInTime"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "checkOutTime"     TIMESTAMP,
  "checkInLat"       DECIMAL(10,7),
  "checkInLng"       DECIMAL(10,7),
  "checkOutLat"      DECIMAL(10,7),
  "checkOutLng"      DECIMAL(10,7),
  "gpsVerified"      BOOLEAN DEFAULT false,
  "distanceFromSite" INTEGER,
  "durationMinutes"  INTEGER,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIMESHEETS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timesheets (
  id               SERIAL PRIMARY KEY,
  "companyId"      INTEGER NOT NULL DEFAULT 1,
  "projectId"      INTEGER,
  "projectName"    VARCHAR(255),
  "workerId"       INTEGER,
  "workerName"     VARCHAR(255) NOT NULL,
  "weekStarting"   VARCHAR(20) NOT NULL,
  "mondayHours"    DECIMAL(5,2) DEFAULT 0,
  "tuesdayHours"   DECIMAL(5,2) DEFAULT 0,
  "wednesdayHours" DECIMAL(5,2) DEFAULT 0,
  "thursdayHours"  DECIMAL(5,2) DEFAULT 0,
  "fridayHours"    DECIMAL(5,2) DEFAULT 0,
  "saturdayHours"  DECIMAL(5,2) DEFAULT 0,
  "sundayHours"    DECIMAL(5,2) DEFAULT 0,
  "totalHours"     DECIMAL(6,2) DEFAULT 0,
  "overtimeHours"  DECIMAL(6,2) DEFAULT 0,
  status           timesheet_status NOT NULL DEFAULT 'draft',
  "submittedAt"    TIMESTAMP,
  "approvedBy"     VARCHAR(255),
  "approvedAt"     TIMESTAMP,
  notes            TEXT,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INCIDENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id                 SERIAL PRIMARY KEY,
  "projectId"        INTEGER NOT NULL,
  title              VARCHAR(255) NOT NULL,
  description        TEXT,
  type               incident_type NOT NULL,
  severity           incident_severity NOT NULL,
  status             incident_status NOT NULL DEFAULT 'open',
  location           VARCHAR(255),
  "reportedBy"       VARCHAR(255) NOT NULL,
  "injuredPerson"    VARCHAR(255),
  witnesses          TEXT,
  "immediateAction"  TEXT,
  "rootCause"        TEXT,
  "correctiveAction" TEXT,
  "photoUrls"        TEXT DEFAULT '[]',
  "riddorRequired"   BOOLEAN DEFAULT false,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DEFECTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS defects (
  id           SERIAL PRIMARY KEY,
  "projectId"  INTEGER NOT NULL,
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  location     VARCHAR(255),
  trade        VARCHAR(100),
  priority     defect_priority NOT NULL DEFAULT 'medium',
  status       defect_status NOT NULL DEFAULT 'open',
  "assignedTo" VARCHAR(255),
  "reportedBy" VARCHAR(255) NOT NULL,
  "dueDate"    TIMESTAMP,
  "resolvedAt" TIMESTAMP,
  "photoUrls"  TEXT DEFAULT '[]',
  "aiAnalysis" TEXT,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PERMITS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permits (
  id          SERIAL PRIMARY KEY,
  "projectId" INTEGER NOT NULL,
  title       VARCHAR(255) NOT NULL,
  type        permit_type NOT NULL,
  status      permit_status NOT NULL DEFAULT 'draft',
  location    VARCHAR(255),
  "issuedBy"  VARCHAR(255),
  "issuedTo"  VARCHAR(255),
  "validFrom" TIMESTAMP,
  "validTo"   TIMESTAMP,
  conditions  TEXT,
  "riskLevel" permit_risk_level NOT NULL DEFAULT 'medium',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DAILY REPORTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_reports (
  id                   SERIAL PRIMARY KEY,
  "projectId"          INTEGER NOT NULL,
  "reportDate"         TIMESTAMP NOT NULL,
  weather              VARCHAR(100),
  temperature          INTEGER,
  "workersOnSite"      INTEGER DEFAULT 0,
  "workCompleted"      TEXT,
  "materialsUsed"      TEXT,
  "equipmentUsed"      TEXT,
  "issuesDelays"       TEXT,
  "safetyObservations" TEXT,
  "nextDayPlan"        TEXT,
  "photoUrls"          TEXT DEFAULT '[]',
  "submittedBy"        VARCHAR(255) NOT NULL,
  status               daily_report_status NOT NULL DEFAULT 'draft',
  "createdAt"          TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- FILES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS files (
  id           SERIAL PRIMARY KEY,
  "projectId"  INTEGER,
  "uploadedBy" INTEGER,
  name         VARCHAR(255) NOT NULL,
  category     file_category NOT NULL DEFAULT 'document',
  "mimeType"   VARCHAR(100),
  "sizeBytes"  INTEGER,
  "storageKey" VARCHAR(500) NOT NULL,
  "storageUrl" TEXT,
  description  TEXT,
  tags         TEXT DEFAULT '[]',
  "aiAnalysis" TEXT,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DOCUMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id            SERIAL PRIMARY KEY,
  "projectId"   INTEGER,
  type          document_type NOT NULL,
  title         VARCHAR(255) NOT NULL,
  content       TEXT,
  "storageKey"  VARCHAR(500),
  "storageUrl"  TEXT,
  "generatedBy" VARCHAR(255),
  status        document_status NOT NULL DEFAULT 'draft',
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PUSH TOKENS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_tokens (
  id         SERIAL PRIMARY KEY,
  "userId"   INTEGER NOT NULL,
  token      VARCHAR(500) NOT NULL,
  platform   platform NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPANIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id                 SERIAL PRIMARY KEY,
  name               VARCHAR(255) NOT NULL,
  slug               VARCHAR(100) NOT NULL UNIQUE,
  plan               VARCHAR(20)  NOT NULL DEFAULT 'free',
  "logoUrl"          TEXT,
  "primaryColor"     VARCHAR(7)   DEFAULT '#1E3A5F',
  utr                VARCHAR(20),
  "cisStatus"        VARCHAR(20)  DEFAULT 'not_registered',
  "vatNumber"        VARCHAR(20),
  "companyNumber"    VARCHAR(20),
  address            TEXT,
  phone              VARCHAR(30),
  email              VARCHAR(255),
  "payrollEmail"     VARCHAR(255),
  website            VARCHAR(255),
  "activeAiProvider" VARCHAR(50)  DEFAULT 'forge',
  "activeAiModel"    VARCHAR(100) DEFAULT 'default',
  "maxProjects"      INTEGER DEFAULT 5,
  "maxUsers"         INTEGER DEFAULT 10,
  "maxPipelines"     INTEGER DEFAULT 1,
  "isActive"         BOOLEAN DEFAULT true,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPANY API KEYS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_api_keys (
  id             SERIAL PRIMARY KEY,
  "companyId"    INTEGER NOT NULL,
  provider       VARCHAR(50) NOT NULL,
  "keyName"      VARCHAR(100) NOT NULL,
  "maskedKey"    VARCHAR(50) NOT NULL,
  "encryptedKey" TEXT NOT NULL,
  model          VARCHAR(100),
  "isActive"     BOOLEAN DEFAULT true,
  "isDefault"    BOOLEAN DEFAULT false,
  "lastUsedAt"   TIMESTAMP,
  "totalCalls"   INTEGER DEFAULT 0,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPANY FEATURE FLAGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_feature_flags (
  id          SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  feature     VARCHAR(100) NOT NULL,
  enabled     BOOLEAN DEFAULT false,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- COMPANY USERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_users (
  id            SERIAL PRIMARY KEY,
  "companyId"   INTEGER NOT NULL,
  "userId"      INTEGER NOT NULL,
  "companyRole" VARCHAR(30) NOT NULL DEFAULT 'worker',
  "jobTitle"    VARCHAR(100),
  department    VARCHAR(100),
  "isActive"    BOOLEAN DEFAULT true,
  "joinedAt"    TIMESTAMP DEFAULT NOW(),
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INSPECTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspections (
  id               SERIAL PRIMARY KEY,
  "companyId"      INTEGER NOT NULL,
  "projectId"      INTEGER NOT NULL,
  "conductedById"  INTEGER NOT NULL,
  title            VARCHAR(255) NOT NULL,
  type             VARCHAR(100) DEFAULT 'general',
  status           VARCHAR(20)  DEFAULT 'draft',
  "checklistItems" TEXT,
  "overallResult"  VARCHAR(20),
  notes            TEXT,
  "photoUrls"      TEXT DEFAULT '[]',
  "scheduledAt"    VARCHAR(20),
  "completedAt"    TIMESTAMP,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RFIs
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfis (
  id               SERIAL PRIMARY KEY,
  "companyId"      INTEGER NOT NULL,
  "projectId"      INTEGER NOT NULL,
  "raisedById"     INTEGER NOT NULL,
  number           VARCHAR(50),
  subject          VARCHAR(255) NOT NULL,
  question         TEXT NOT NULL,
  response         TEXT,
  status           VARCHAR(20) DEFAULT 'open',
  priority         VARCHAR(20) DEFAULT 'normal',
  "dueDate"        VARCHAR(20),
  "attachmentUrls" TEXT DEFAULT '[]',
  "respondedAt"    TIMESTAMP,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- OBSERVATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS observations (
  id             SERIAL PRIMARY KEY,
  "companyId"    INTEGER NOT NULL,
  "projectId"    INTEGER NOT NULL,
  "observedById" INTEGER NOT NULL,
  type           VARCHAR(30) DEFAULT 'positive',
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  location       VARCHAR(255),
  "photoUrls"    TEXT DEFAULT '[]',
  status         VARCHAR(20) DEFAULT 'open',
  "createdAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DRAWINGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drawings (
  id              SERIAL PRIMARY KEY,
  "companyId"     INTEGER NOT NULL,
  "projectId"     INTEGER NOT NULL,
  "uploadedById"  INTEGER NOT NULL,
  title           VARCHAR(255) NOT NULL,
  "drawingNumber" VARCHAR(100),
  revision        VARCHAR(20),
  discipline      VARCHAR(100),
  "fileUrl"       TEXT NOT NULL,
  "thumbnailUrl"  TEXT,
  "fileSize"      INTEGER,
  status          VARCHAR(20) DEFAULT 'current',
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ANNOUNCEMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id            SERIAL PRIMARY KEY,
  "companyId"   INTEGER NOT NULL,
  "projectId"   INTEGER,
  "createdById" INTEGER NOT NULL,
  title         VARCHAR(255) NOT NULL,
  body          TEXT NOT NULL,
  priority      VARCHAR(20) DEFAULT 'normal',
  "isPinned"    BOOLEAN DEFAULT false,
  "expiresAt"   TIMESTAMP,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ACTION PLANS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS action_plans (
  id             SERIAL PRIMARY KEY,
  "companyId"    INTEGER NOT NULL,
  "projectId"    INTEGER NOT NULL,
  "createdById"  INTEGER NOT NULL,
  "assignedToId" INTEGER,
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  "linkedTo"     VARCHAR(50),
  "linkedId"     INTEGER,
  status         VARCHAR(20) DEFAULT 'open',
  priority       VARCHAR(20) DEFAULT 'medium',
  "dueDate"      VARCHAR(20),
  "completedAt"  TIMESTAMP,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ENQUIRY PIPELINES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiry_pipelines (
  id          SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  name        VARCHAR(100) NOT NULL,
  stages      TEXT NOT NULL,
  "isDefault" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ENQUIRIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS enquiries (
  id             SERIAL PRIMARY KEY,
  "companyId"    INTEGER NOT NULL,
  "pipelineId"   INTEGER NOT NULL,
  "assignedToId" INTEGER,
  "clientName"   VARCHAR(255) NOT NULL,
  "clientEmail"  VARCHAR(255),
  "clientPhone"  VARCHAR(30),
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  value          DECIMAL(12,2),
  stage          VARCHAR(100) NOT NULL,
  source         VARCHAR(50) DEFAULT 'manual',
  status         VARCHAR(20) DEFAULT 'active',
  notes          TEXT,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TENDERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenders (
  id             SERIAL PRIMARY KEY,
  "companyId"    INTEGER NOT NULL,
  "projectId"    INTEGER,
  "createdById"  INTEGER NOT NULL,
  title          VARCHAR(255) NOT NULL,
  "clientName"   VARCHAR(255),
  status         VARCHAR(20) DEFAULT 'draft',
  "totalValue"   DECIMAL(14,2),
  "lineItems"    TEXT,
  "importSource" VARCHAR(20),
  notes          TEXT,
  "submittedAt"  TIMESTAMP,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                   SERIAL PRIMARY KEY,
  "companyId"          INTEGER NOT NULL,
  "projectId"          INTEGER,
  "createdById"        INTEGER NOT NULL,
  "invoiceNumber"      VARCHAR(50) NOT NULL,
  type                 VARCHAR(30) DEFAULT 'invoice',
  status               VARCHAR(20) DEFAULT 'draft',
  "clientName"         VARCHAR(255),
  "clientEmail"        VARCHAR(255),
  "issueDate"          VARCHAR(20),
  "dueDate"            VARCHAR(20),
  "vatRate"            VARCHAR(30) DEFAULT 'standard_20',
  "isCisJob"           BOOLEAN DEFAULT false,
  "cisDeductionRate"   INTEGER DEFAULT 0,
  "grossLabourOnSite"  DECIMAL(12,2) DEFAULT 0,
  "grossLabourOffSite" DECIMAL(12,2) DEFAULT 0,
  "cisDeductionAmount" DECIMAL(12,2) DEFAULT 0,
  subtotal             DECIMAL(12,2) DEFAULT 0,
  "vatAmount"          DECIMAL(12,2) DEFAULT 0,
  total                DECIMAL(12,2) DEFAULT 0,
  "netPayable"         DECIMAL(12,2) DEFAULT 0,
  "lineItems"          TEXT,
  notes                TEXT,
  "photoUrl"           TEXT,
  "aiExtracted"        BOOLEAN DEFAULT false,
  "approvedById"       INTEGER,
  "approvedAt"         TIMESTAMP,
  "paidAt"             TIMESTAMP,
  "createdAt"          TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PROJECT BOOKMARKS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_bookmarks (
  id          SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL,
  "userId"    INTEGER NOT NULL,
  "projectId" INTEGER NOT NULL,
  "itemType"  VARCHAR(50) NOT NULL,
  "itemId"    VARCHAR(100) NOT NULL,
  "itemTitle" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- DRAWING PINS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drawing_pins (
  id              SERIAL PRIMARY KEY,
  "companyId"     INTEGER NOT NULL DEFAULT 1,
  "drawingId"     VARCHAR(100) NOT NULL,
  "drawingNumber" VARCHAR(255),
  "pinType"       pin_type NOT NULL DEFAULT 'note',
  "xPct"          DECIMAL(6,4) NOT NULL,
  "yPct"          DECIMAL(6,4) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  "assignedTo"    VARCHAR(255),
  "photoUrl"      VARCHAR(1024),
  status          pin_status NOT NULL DEFAULT 'open',
  "createdBy"     VARCHAR(255),
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- INVITED USERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invited_users (
  id              SERIAL PRIMARY KEY,
  "companyId"     INTEGER NOT NULL DEFAULT 1,
  email           VARCHAR(320) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  role            VARCHAR(64) NOT NULL DEFAULT 'field_worker',
  "employeeClass" VARCHAR(64) NOT NULL DEFAULT 'Operative',
  "projectId"     VARCHAR(100),
  "projectName"   VARCHAR(255),
  pin             VARCHAR(8) NOT NULL,
  status          invite_status NOT NULL DEFAULT 'pending',
  "invitedBy"     VARCHAR(255) NOT NULL,
  "expiresAt"     TIMESTAMP NOT NULL,
  "acceptedAt"    TIMESTAMP,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- EMPLOYEE CREDENTIALS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_credentials (
  id               SERIAL PRIMARY KEY,
  "companyId"      INTEGER NOT NULL DEFAULT 1,
  "employeeId"     VARCHAR(100) NOT NULL,
  "employeeName"   VARCHAR(255) NOT NULL,
  "credType"       VARCHAR(64) NOT NULL,
  "credNumber"     VARCHAR(100),
  "issueDate"      VARCHAR(20),
  "expiryDate"     VARCHAR(20),
  "alertSent"      INTEGER NOT NULL DEFAULT 0,
  notes            TEXT,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: Default company
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO companies (name, slug, plan, "isActive")
VALUES ('CortexBuild Field', 'cortexbuild-field', 'pro', true)
ON CONFLICT (slug) DO NOTHING;
