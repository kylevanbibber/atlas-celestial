-- team_custom table creation script
-- This table stores customization settings for MGAs and RGAs

CREATE TABLE IF NOT EXISTS `team_custom` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `team_id` VARCHAR(36) NOT NULL,
  `team_type` ENUM('MGA', 'RGA') NOT NULL,
  `team_name` VARCHAR(50) DEFAULT 'Arias Organization',
  `logo_url` VARCHAR(255) DEFAULT NULL,
  `logo_width` INT DEFAULT 200,
  `logo_height` INT DEFAULT 80,
  `logo_delete_hash` VARCHAR(255) DEFAULT NULL COMMENT 'For external image services like Imgur',
  `primary_color` VARCHAR(7) DEFAULT NULL COMMENT 'Hex color code',
  `secondary_color` VARCHAR(7) DEFAULT NULL COMMENT 'Hex color code',
  `accent_color` VARCHAR(7) DEFAULT NULL COMMENT 'Hex color code',
  `custom_font` VARCHAR(255) DEFAULT NULL,
  `custom_css` TEXT DEFAULT NULL,
  `dashboard_layout` JSON DEFAULT NULL,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `team_unique` (`team_id`, `team_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS `idx_team_custom_team` ON `team_custom` (`team_id`, `team_type`);
CREATE INDEX IF NOT EXISTS `idx_team_custom_created_by` ON `team_custom` (`created_by`);

-- Example inserts (commented out)
/*
INSERT INTO `team_custom` 
  (`team_id`, `team_type`, `primary_color`, `secondary_color`, `created_by`) 
VALUES 
  ('SOME_RGA_ID', 'RGA', '#FF5733', '#33FF57', 1),
  ('SOME_MGA_ID', 'MGA', '#3357FF', '#FF33A8', 1);
*/ 