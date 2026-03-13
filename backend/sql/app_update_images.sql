-- Table to store images attached to updates

CREATE TABLE IF NOT EXISTS `app_update_images` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `updateId` INT NOT NULL,
  `url` VARCHAR(1024) NOT NULL,
  `deleteHash` VARCHAR(128) NULL,
  `caption` VARCHAR(255) NULL,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_updateId` (`updateId`),
  CONSTRAINT `fk_app_update_images_update`
    FOREIGN KEY (`updateId`) REFERENCES `app_updates`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


