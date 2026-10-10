CREATE TABLE `trade_in_images` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`side` text NOT NULL,
	FOREIGN KEY (`request_id`) REFERENCES `trade_in_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "trade_in_image_side_values" CHECK("trade_in_images"."side" IN ('front','back','additional1','additional2')),
	CONSTRAINT "trade_in_image_mime_values" CHECK("trade_in_images"."mime_type" IN ('image/jpeg','image/png','image/webp'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trade_in_images_object_key_unique` ON `trade_in_images` (`object_key`);--> statement-breakpoint
CREATE INDEX `trade_in_images_request_idx` ON `trade_in_images` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `trade_in_images_request_side_idx` ON `trade_in_images` (`request_id`,`side`);--> statement-breakpoint
CREATE TABLE `trade_in_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`reference` text NOT NULL,
	`fingerprint` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	CONSTRAINT "trade_in_request_state_values" CHECK("trade_in_requests"."state" IN ('active','deleting','deleted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trade_in_requests_request_id_unique` ON `trade_in_requests` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `trade_in_requests_reference_unique` ON `trade_in_requests` (`reference`);--> statement-breakpoint
CREATE INDEX `trade_in_requests_state_created_idx` ON `trade_in_requests` (`state`,`created_at`);