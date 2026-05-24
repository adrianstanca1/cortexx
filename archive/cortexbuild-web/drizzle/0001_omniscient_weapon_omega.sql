CREATE TABLE `agent_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_config_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`waId` varchar(64) NOT NULL,
	`phoneNumber` varchar(32) NOT NULL,
	`displayName` varchar(255),
	`profileName` varchar(255),
	`projectTag` varchar(255),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastSeenAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contacts_waId_unique` UNIQUE(`waId`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`waConversationId` varchar(128),
	`title` varchar(255),
	`projectTag` varchar(255),
	`summary` text,
	`messageCount` int NOT NULL DEFAULT 0,
	`imageCount` int NOT NULL DEFAULT 0,
	`issueCount` int NOT NULL DEFAULT 0,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`conversationId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`category` enum('safety_hazard','structural','electrical','plumbing','material','schedule_delay','quality','equipment','weather','other') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`detectedFrom` enum('text','image','both') NOT NULL DEFAULT 'text',
	`sourceMessageId` int,
	`relatedMediaIds` json,
	`projectTag` varchar(255),
	`location` varchar(255),
	`assignedTo` varchar(255),
	`resolvedAt` timestamp,
	`aiDetected` boolean NOT NULL DEFAULT true,
	`aiConfidence` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `issues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`contactId` int NOT NULL,
	`messageId` int,
	`waMediaId` varchar(128),
	`mediaType` enum('image','document','audio','video') NOT NULL,
	`mimeType` varchar(128),
	`fileName` varchar(255),
	`fileSize` bigint,
	`s3Key` varchar(512) NOT NULL,
	`s3Url` text NOT NULL,
	`visionAnalyzed` boolean NOT NULL DEFAULT false,
	`visionDescription` text,
	`visionTags` json,
	`visionIssuesDetected` json,
	`visionSafetyHazards` json,
	`visionProgressNotes` text,
	`visionConfidence` float,
	`visionAnalyzedAt` timestamp,
	`caption` text,
	`projectTag` varchar(255),
	`sentAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memory_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactId` int NOT NULL,
	`conversationId` int,
	`sectionType` enum('key_decision','instruction','project_update','issue_mention','contact_info','general') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`sourceMessageId` int,
	`relatedMediaIds` json,
	`projectTag` varchar(255),
	`importance` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `memory_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`contactId` int NOT NULL,
	`waMessageId` varchar(128),
	`direction` enum('inbound','outbound') NOT NULL,
	`messageType` enum('text','image','document','audio','video','location','sticker','reaction','system') NOT NULL,
	`body` text,
	`mediaId` int,
	`isKeySection` boolean NOT NULL DEFAULT false,
	`keyLabel` varchar(255),
	`aiProcessed` boolean NOT NULL DEFAULT false,
	`sentAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `messages_waMessageId_unique` UNIQUE(`waMessageId`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`reportType` enum('daily_summary','weekly_summary','issue_report','custom') NOT NULL,
	`format` enum('pdf','html','both') NOT NULL DEFAULT 'both',
	`contactId` int,
	`projectTag` varchar(255),
	`dateFrom` timestamp NOT NULL,
	`dateTo` timestamp NOT NULL,
	`stats` json,
	`pdfS3Key` varchar(512),
	`pdfS3Url` text,
	`htmlS3Key` varchar(512),
	`htmlS3Url` text,
	`sentToWhatsapp` boolean NOT NULL DEFAULT false,
	`sentToEmail` boolean NOT NULL DEFAULT false,
	`sentAt` timestamp,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`frequency` enum('daily','weekly') NOT NULL,
	`reportType` enum('daily_summary','weekly_summary','issue_report') NOT NULL,
	`format` enum('pdf','html','both') NOT NULL DEFAULT 'both',
	`projectTag` varchar(255),
	`sendToWhatsapp` boolean NOT NULL DEFAULT true,
	`whatsappRecipient` varchar(64),
	`sendToEmail` boolean NOT NULL DEFAULT false,
	`emailRecipient` varchar(320),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_reports_id` PRIMARY KEY(`id`)
);
