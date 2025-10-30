-- Fix created_at column to NOT auto-update on row changes
-- This ensures created_at only gets set when the row is first created,
-- and last_updated gets updated on changes

-- Check current column definition
SHOW CREATE TABLE leads_released;

-- Modify created_at column to remove ON UPDATE CURRENT_TIMESTAMP
-- Adjust the column definition based on what you see above
-- Common scenarios:

-- If created_at is DATETIME:
ALTER TABLE leads_released 
MODIFY COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- If created_at is TIMESTAMP:
ALTER TABLE leads_released 
MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Verify the change
SHOW CREATE TABLE leads_released;

-- Optional: If you want to ensure last_updated DOES auto-update:
ALTER TABLE leads_released 
MODIFY COLUMN last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

