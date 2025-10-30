-- Safe migration to drop img column from leads_released if it exists
-- Works for MySQL 8.0+

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'leads_released'
    AND COLUMN_NAME = 'img'
);

SET @sql := IF(@col_exists > 0,
  'ALTER TABLE leads_released DROP COLUMN img',
  'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


