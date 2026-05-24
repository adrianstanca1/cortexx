-- CortexBuild Field v1.5-v2.0 migration
-- Adds: drawing_pins, invited_users, employee_credentials tables
-- Alters: timesheets (new columns), companies (payrollEmail)

-- ============================================================
-- 1. timesheets — add v1.5 approval workflow columns
-- ============================================================
ALTER TABLE `timesheets`
  ADD COLUMN IF NOT EXISTS `companyId` varchar(255),
  ADD COLUMN IF NOT EXISTS `overtimeHours` decimal(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `submittedAt` timestamp,
  ADD COLUMN IF NOT EXISTS `projectName` varchar(255);--> statement-breakpoint

-- ============================================================
-- 2. drawing_pins — shared pin annotations on drawings
-- ============================================================
CREATE TABLE IF NOT EXISTS `drawing_pins` (
  `id` varchar(255) NOT NULL,
  `drawingId` varchar(255) NOT NULL,
  `x` decimal(10,6) NOT NULL,
  `y` decimal(10,6) NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'note',
  `description` text,
  `assignedTo` varchar(255),
  `createdBy` varchar(255),
  `companyId` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `drawing_pins_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

-- ============================================================
-- 3. invited_users — pending invitations with temporary PINs
-- ============================================================
CREATE TABLE IF NOT EXISTS `invited_users` (
  `id` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `pin` varchar(10) NOT NULL,
  `role` varchar(50) NOT NULL DEFAULT 'worker',
  `employeeClass` varchar(50),
  `projectId` varchar(255),
  `companyId` varchar(255),
  `invitedBy` varchar(255),
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `expiresAt` timestamp NOT NULL,
  `acceptedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `invited_users_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

-- ============================================================
-- 4. employee_credentials — certifications and compliance docs
-- ============================================================
CREATE TABLE IF NOT EXISTS `employee_credentials` (
  `id` varchar(255) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `companyId` varchar(255),
  `type` varchar(100) NOT NULL,
  `number` varchar(255),
  `issuedBy` varchar(255),
  `issuedAt` timestamp,
  `expiresAt` timestamp,
  `notes` text,
  `documentUrl` varchar(1024),
  `alertSent` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `employee_credentials_id` PRIMARY KEY(`id`)
);--> statement-breakpoint

-- ============================================================
-- 5. companies — add payrollEmail column
-- ============================================================
ALTER TABLE `companies`
  ADD COLUMN IF NOT EXISTS `payrollEmail` varchar(255);--> statement-breakpoint
