CREATE TABLE `phone_images` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`phone_id`) REFERENCES `phone_listings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `phone_images_object_key_unique` ON `phone_images` (`object_key`);--> statement-breakpoint
CREATE INDEX `phone_images_phone_idx` ON `phone_images` (`phone_id`);--> statement-breakpoint
CREATE TABLE `phone_listings` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`model` text NOT NULL,
	`storage` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`condition` text NOT NULL,
	`price_cents` integer NOT NULL,
	`battery` integer,
	`description` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "phone_price_range" CHECK("phone_listings"."price_cents" BETWEEN 1 AND 1000000),
	CONSTRAINT "phone_battery_range" CHECK("phone_listings"."battery" IS NULL OR "phone_listings"."battery" BETWEEN 0 AND 100),
	CONSTRAINT "phone_condition_values" CHECK("phone_listings"."condition" IN ('excellent','good','fair')),
	CONSTRAINT "phone_status_values" CHECK("phone_listings"."status" IN ('draft','published','sold'))
);
--> statement-breakpoint
CREATE INDEX `phone_listings_status_updated_idx` ON `phone_listings` (`status`,`updated_at`);