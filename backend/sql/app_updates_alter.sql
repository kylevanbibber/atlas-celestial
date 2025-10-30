-- Add tutorial and page link columns to updates

ALTER TABLE `app_updates`
  ADD COLUMN `tutorialUrl` VARCHAR(1024) NULL AFTER `priority`,
  ADD COLUMN `pageUrl` VARCHAR(1024) NULL AFTER `tutorialUrl`,
  ADD COLUMN `releaseId` INT NULL AFTER `pageUrl`,
  ADD COLUMN `version` VARCHAR(50) NULL AFTER `releaseId`,
  ADD COLUMN `targetDevice` ENUM('mobile','desktop') NULL AFTER `version`,
  ADD INDEX (`releaseId`);

CREATE TABLE IF NOT EXISTS `app_releases` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `version` VARCHAR(50) NULL,
  `title` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


