import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config({ path: '.env' });

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS \`projects\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`description\` text,
    \`clientName\` varchar(255),
    \`status\` enum('planning','active','on_hold','completed','cancelled') NOT NULL DEFAULT 'planning',
    \`startDate\` timestamp NULL,
    \`endDate\` timestamp NULL,
    \`budget\` decimal(12,2),
    \`spent\` decimal(12,2) DEFAULT '0',
    \`progress\` int DEFAULT 0,
    \`siteAddress\` text,
    \`siteLat\` decimal(10,7),
    \`siteLng\` decimal(10,7),
    \`geofenceRadius\` int DEFAULT 200,
    \`projectManager\` varchar(255),
    \`contractType\` varchar(100),
    \`createdBy\` int,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`projects_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`tasks\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`title\` varchar(255) NOT NULL,
    \`description\` text,
    \`status\` enum('not_started','in_progress','completed','blocked','on_hold') NOT NULL DEFAULT 'not_started',
    \`priority\` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    \`assignedTo\` varchar(255),
    \`dueDate\` timestamp NULL,
    \`completedAt\` timestamp NULL,
    \`progress\` int DEFAULT 0,
    \`trade\` varchar(100),
    \`createdBy\` int,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`tasks_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`team_members\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`name\` varchar(255) NOT NULL,
    \`role\` varchar(100) NOT NULL,
    \`trade\` varchar(100),
    \`email\` varchar(320),
    \`phone\` varchar(30),
    \`cscsCardType\` varchar(100),
    \`cscsExpiry\` timestamp NULL,
    \`status\` enum('active','inactive','on_leave') NOT NULL DEFAULT 'active',
    \`projectId\` int,
    \`hourlyRate\` decimal(8,2),
    \`avatarUrl\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`team_members_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`timesheets\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`workerId\` int,
    \`workerName\` varchar(255) NOT NULL,
    \`weekStarting\` timestamp NOT NULL,
    \`mondayHours\` decimal(5,2) DEFAULT '0',
    \`tuesdayHours\` decimal(5,2) DEFAULT '0',
    \`wednesdayHours\` decimal(5,2) DEFAULT '0',
    \`thursdayHours\` decimal(5,2) DEFAULT '0',
    \`fridayHours\` decimal(5,2) DEFAULT '0',
    \`saturdayHours\` decimal(5,2) DEFAULT '0',
    \`sundayHours\` decimal(5,2) DEFAULT '0',
    \`totalHours\` decimal(6,2) DEFAULT '0',
    \`status\` enum('draft','submitted','approved','rejected') NOT NULL DEFAULT 'draft',
    \`approvedBy\` varchar(255),
    \`approvedAt\` timestamp NULL,
    \`notes\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`timesheets_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`incidents\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`title\` varchar(255) NOT NULL,
    \`description\` text,
    \`type\` enum('near_miss','first_aid','accident','dangerous_occurrence','environmental','security') NOT NULL,
    \`severity\` enum('near_miss','low','medium','high','critical') NOT NULL,
    \`status\` enum('open','under_investigation','action_required','resolved','closed') NOT NULL DEFAULT 'open',
    \`location\` varchar(255),
    \`reportedBy\` varchar(255) NOT NULL,
    \`injuredPerson\` varchar(255),
    \`witnesses\` text,
    \`immediateAction\` text,
    \`rootCause\` text,
    \`correctiveAction\` text,
    \`photoUrls\` text,
    \`riddorRequired\` boolean DEFAULT false,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`incidents_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`defects\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`title\` varchar(255) NOT NULL,
    \`description\` text,
    \`location\` varchar(255),
    \`trade\` varchar(100),
    \`priority\` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    \`status\` enum('open','in_progress','resolved','closed','disputed') NOT NULL DEFAULT 'open',
    \`assignedTo\` varchar(255),
    \`reportedBy\` varchar(255) NOT NULL,
    \`dueDate\` timestamp NULL,
    \`resolvedAt\` timestamp NULL,
    \`photoUrls\` text,
    \`aiAnalysis\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`defects_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`permits\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`title\` varchar(255) NOT NULL,
    \`type\` enum('hot_work','confined_space','excavation','working_at_height','electrical','general') NOT NULL,
    \`status\` enum('draft','pending','active','expired','cancelled') NOT NULL DEFAULT 'draft',
    \`location\` varchar(255),
    \`issuedBy\` varchar(255),
    \`issuedTo\` varchar(255),
    \`validFrom\` timestamp NULL,
    \`validTo\` timestamp NULL,
    \`conditions\` text,
    \`riskLevel\` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`permits_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`daily_reports\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int NOT NULL,
    \`reportDate\` timestamp NOT NULL,
    \`weather\` varchar(100),
    \`temperature\` int,
    \`workersOnSite\` int DEFAULT 0,
    \`workCompleted\` text,
    \`materialsUsed\` text,
    \`equipmentUsed\` text,
    \`issuesDelays\` text,
    \`safetyObservations\` text,
    \`nextDayPlan\` text,
    \`photoUrls\` text,
    \`submittedBy\` varchar(255) NOT NULL,
    \`status\` enum('draft','submitted','approved') NOT NULL DEFAULT 'draft',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`daily_reports_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`files\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int,
    \`uploadedBy\` int,
    \`name\` varchar(255) NOT NULL,
    \`category\` enum('photo','certificate','payslip','drawing','report','document','other') NOT NULL DEFAULT 'document',
    \`mimeType\` varchar(100),
    \`sizeBytes\` int,
    \`storageKey\` varchar(500) NOT NULL,
    \`storageUrl\` text,
    \`description\` text,
    \`tags\` text,
    \`aiAnalysis\` text,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`files_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`documents\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`projectId\` int,
    \`type\` enum('rams','toolbox_talk','daily_report','invoice','timesheet','other') NOT NULL,
    \`title\` varchar(255) NOT NULL,
    \`content\` text,
    \`storageKey\` varchar(500),
    \`storageUrl\` text,
    \`generatedBy\` varchar(255),
    \`status\` enum('draft','final','sent') NOT NULL DEFAULT 'draft',
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`documents_id\` PRIMARY KEY(\`id\`)
  )`,
  `CREATE TABLE IF NOT EXISTS \`push_tokens\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`userId\` int NOT NULL,
    \`token\` varchar(500) NOT NULL,
    \`platform\` enum('ios','android','web') NOT NULL,
    \`active\` boolean NOT NULL DEFAULT true,
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`push_tokens_id\` PRIMARY KEY(\`id\`)
  )`,
];

async function run() {
  const conn = await createConnection(process.env.DATABASE_URL);
  for (const sql of CREATE_STATEMENTS) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS `(\w+)`/)?.[1] ?? '?';
    try {
      await conn.execute(sql);
      console.log(`✓ Created: ${tableName}`);
    } catch (e) {
      console.log(`✗ ${tableName}: ${e.message.slice(0, 80)}`);
    }
  }
  await conn.end();
  console.log('\nSchema applied successfully.');
}

run().catch(console.error);
