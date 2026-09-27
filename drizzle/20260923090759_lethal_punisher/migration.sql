CREATE TABLE `reader_state` (
	`user_id` text PRIMARY KEY,
	`state` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_reader_state_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
