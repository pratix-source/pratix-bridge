CREATE TABLE `pairing_sessions` (
	`id` varchar(32) NOT NULL,
	`pinHash` varchar(64) NOT NULL,
	`hostToken` varchar(48) NOT NULL,
	`guestToken` varchar(48),
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pairing_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pairing_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(32) NOT NULL,
	`recipientRole` enum('host','guest') NOT NULL,
	`payload` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pairing_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `pairing_sessions_pin_expiry_idx` ON `pairing_sessions` (`pinHash`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `pairing_signals_recipient_idx` ON `pairing_signals` (`sessionId`,`recipientRole`,`id`);