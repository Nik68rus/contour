CREATE TABLE `mask_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`title` text NOT NULL,
	`state_json` text NOT NULL,
	`image_key` text NOT NULL,
	`image_name` text NOT NULL,
	`image_type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mask_projects_user_updated_idx` ON `mask_projects` (`user_email`,`updated_at`);
--> statement-breakpoint
INSERT INTO `mask_projects` (
	`id`,
	`user_email`,
	`title`,
	`state_json`,
	`image_key`,
	`image_name`,
	`image_type`,
	`created_at`,
	`updated_at`
)
SELECT
	lower(hex(randomblob(16))),
	`user_email`,
	COALESCE(NULLIF(`image_name`, ''), 'Первый проект'),
	`state_json`,
	`image_key`,
	COALESCE(NULLIF(`image_name`, ''), 'image'),
	COALESCE(NULLIF(`image_type`, ''), 'application/octet-stream'),
	`updated_at`,
	`updated_at`
FROM `projects`
WHERE `image_key` IS NOT NULL;
