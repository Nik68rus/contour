CREATE TABLE `projects` (
	`user_email` text PRIMARY KEY NOT NULL,
	`state_json` text NOT NULL,
	`image_key` text,
	`image_name` text,
	`image_type` text,
	`updated_at` text NOT NULL
);
