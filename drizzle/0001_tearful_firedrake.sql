ALTER TABLE `phone_listings` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `phone_listings` ADD `write_token` text DEFAULT '' NOT NULL;