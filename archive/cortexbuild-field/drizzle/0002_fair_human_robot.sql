ALTER TABLE `daily_reports` MODIFY COLUMN `photoUrls` text DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `defects` MODIFY COLUMN `photoUrls` text DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `files` MODIFY COLUMN `tags` text DEFAULT ('[]');--> statement-breakpoint
ALTER TABLE `incidents` MODIFY COLUMN `photoUrls` text DEFAULT ('[]');